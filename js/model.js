// =============================================================================
// MODEL - Agenda Semanal Compartilhada
// Persistência: Supabase REST API (via fetch) com fallback para LocalStorage
// =============================================================================

export class Model {
    constructor() {
        this.listeners = {};
        this.profiles = [];
        this.availabilities = {};

        // Credenciais do Supabase (salvas no LocalStorage)
        this.supabaseUrl = localStorage.getItem('agenda_supabase_url') || '';
        this.supabaseKey = localStorage.getItem('agenda_supabase_key') || '';
        this.isSupabaseConnected = false;

        // Estado da semana
        const savedOffset = localStorage.getItem('agenda_week_offset');
        this.weekOffset = savedOffset !== null ? parseInt(savedOffset, 10) : 0;
        this.updateWeekDays();
    }

    // ==========================================================================
    // SISTEMA DE EVENTOS (OBSERVER PATTERN)
    // ==========================================================================
    on(event, callback) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
    }

    notify(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    }

    // ==========================================================================
    // LÓGICA DE DATAS E SEMANA
    // ==========================================================================
    updateWeekDays() {
        const today = new Date();
        today.setHours(12, 0, 0, 0);

        const currentSunday = new Date(today);
        currentSunday.setDate(today.getDate() - today.getDay());

        this.currentSunday = new Date(currentSunday);
        this.currentSunday.setDate(currentSunday.getDate() + (this.weekOffset * 7));

        this.weekDays = [];
        for (let i = 0; i < 7; i++) {
            const day = new Date(this.currentSunday);
            day.setDate(this.currentSunday.getDate() + i);
            this.weekDays.push(day);
        }

        this.weekRef = this.formatDateISO(this.currentSunday);
        localStorage.setItem('agenda_week_offset', this.weekOffset);
    }

    getWeekDays() { return this.weekDays; }
    getWeekRef()  { return this.weekRef; }

    getWeekLabels() {
        const sunday   = this.weekDays[0];
        const saturday = this.weekDays[6];
        const refMonth = saturday.getMonth();
        const refYear  = saturday.getFullYear();

        const meses = [
            'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
            'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
        ];

        let saturdayCount = 0;
        const tempDate = new Date(saturday);
        while (tempDate.getMonth() === refMonth) {
            saturdayCount++;
            tempDate.setDate(tempDate.getDate() - 7);
        }

        const weekName = `${saturdayCount}ª Semana de ${meses[refMonth]}`;
        const pad = n => String(n).padStart(2, '0');
        const rangeStr = `(${pad(sunday.getDate())}/${pad(sunday.getMonth()+1)} a ${pad(saturday.getDate())}/${pad(saturday.getMonth()+1)})`;

        return { title: weekName, range: rangeStr, year: refYear };
    }

    changeWeek(direction) {
        if (direction === 'next')        this.weekOffset += 1;
        else if (direction === 'prev')   this.weekOffset -= 1;
        else if (direction === 'today')  this.weekOffset  = 0;
        this.updateWeekDays();
        this.notify('weekChanged');
        return this.loadData();
    }

    formatDateISO(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    // ==========================================================================
    // SUPABASE REST API — HELPERS
    // ==========================================================================
    _headers() {
        return {
            'Content-Type':  'application/json',
            'apikey':         this.supabaseKey,
            'Authorization': `Bearer ${this.supabaseKey}`,
            'Prefer':         'return=representation'
        };
    }

    _url(table, query = '') {
        return `${this.supabaseUrl}/rest/v1/${table}${query ? '?' + query : ''}`;
    }

    async _get(table, query = '') {
        const res = await fetch(this._url(table, query), {
            method: 'GET',
            headers: { ...this._headers(), 'Prefer': 'return=representation' }
        });
        if (!res.ok) throw new Error(`GET ${table} falhou: ${res.status} ${await res.text()}`);
        return res.json();
    }

    async _post(table, body) {
        const res = await fetch(this._url(table), {
            method:  'POST',
            headers: this._headers(),
            body:    JSON.stringify(body)
        });
        if (!res.ok) throw new Error(`POST ${table} falhou: ${res.status} ${await res.text()}`);
        return res.json();
    }

    async _upsert(table, body) {
        const res = await fetch(this._url(table), {
            method:  'POST',
            headers: { ...this._headers(), 'Prefer': 'resolution=ignore-duplicates,return=representation' },
            body:    JSON.stringify(body)
        });
        if (!res.ok) throw new Error(`UPSERT ${table} falhou: ${res.status} ${await res.text()}`);
        return res.json();
    }

    async _patch(table, query, body) {
        const res = await fetch(this._url(table, query), {
            method:  'PATCH',
            headers: this._headers(),
            body:    JSON.stringify(body)
        });
        if (!res.ok) throw new Error(`PATCH ${table} falhou: ${res.status} ${await res.text()}`);
        return res.json();
    }

    async _delete(table, query) {
        const res = await fetch(this._url(table, query), {
            method:  'DELETE',
            headers: this._headers()
        });
        if (!res.ok) throw new Error(`DELETE ${table} falhou: ${res.status} ${await res.text()}`);
        return true;
    }

    // ==========================================================================
    // CONEXÃO & INICIALIZAÇÃO
    // ==========================================================================
    async init() {
        if (this.supabaseUrl && this.supabaseKey) {
            try {
                // Teste rápido: lista perfis (mesmo que vazio é OK)
                await this._get('agenda_perfis', 'limit=1');
                this.isSupabaseConnected = true;
                this.notify('dbStatusChanged', { status: 'supabase' });
            } catch (err) {
                console.error('Falha ao conectar ao Supabase, usando LocalStorage:', err);
                this.isSupabaseConnected = false;
                this.notify('dbStatusChanged', { status: 'local', error: err.message });
            }
        } else {
            this.isSupabaseConnected = false;
            this.notify('dbStatusChanged', { status: 'local' });
        }

        await this.loadData();
    }

    async setCredentials(url, key) {
        if (url && key) {
            // Normaliza a URL (remove barra no final)
            const cleanUrl = url.replace(/\/$/, '');
            try {
                // Salva temporariamente para testar
                const prevUrl = this.supabaseUrl;
                const prevKey = this.supabaseKey;
                this.supabaseUrl = cleanUrl;
                this.supabaseKey = key;

                await this._get('agenda_perfis', 'limit=1');

                // Deu certo: persiste
                localStorage.setItem('agenda_supabase_url', cleanUrl);
                localStorage.setItem('agenda_supabase_key', key);
                this.isSupabaseConnected = true;
                this.notify('dbStatusChanged', { status: 'supabase' });
                await this.loadData();
                return { success: true };
            } catch (err) {
                // Reverte
                this.supabaseUrl = localStorage.getItem('agenda_supabase_url') || '';
                this.supabaseKey = localStorage.getItem('agenda_supabase_key') || '';
                return { success: false, error: err.message };
            }
        } else {
            // Desconectar
            this.supabaseUrl = '';
            this.supabaseKey = '';
            localStorage.removeItem('agenda_supabase_url');
            localStorage.removeItem('agenda_supabase_key');
            this.isSupabaseConnected = false;
            this.notify('dbStatusChanged', { status: 'local' });
            await this.loadData();
            return { success: true };
        }
    }

    async testConnection(url, key) {
        try {
            const cleanUrl = url.replace(/\/$/, '');
            const res = await fetch(`${cleanUrl}/rest/v1/agenda_perfis?limit=1`, {
                method: 'GET',
                headers: {
                    'apikey':        key,
                    'Authorization': `Bearer ${key}`
                }
            });
            if (!res.ok) {
                const txt = await res.text();
                return { success: false, error: `HTTP ${res.status}: ${txt}` };
            }
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    // ==========================================================================
    // CARREGAMENTO DE DADOS
    // ==========================================================================
    async loadData() {
        if (this.isSupabaseConnected) {
            try {
                // Perfis
                const perfis = await this._get('agenda_perfis', 'order=nome');
                this.profiles = perfis.map(p => ({
                    id:     p.id,
                    nome:   p.nome,
                    cor:    p.cor,
                    avatar: p.avatar
                }));

                // Disponibilidades da semana atual
                const avails = await this._get(
                    'agenda_disponibilidade',
                    `semana_ref=eq.${this.weekRef}&select=perfil_id,dia_semana,slot_hora`
                );

                this.availabilities = {};
                avails.forEach(av => {
                    const key = `${av.perfil_id}_${this.weekRef}`;
                    if (!this.availabilities[key]) this.availabilities[key] = new Set();
                    this.availabilities[key].add(`${av.dia_semana}_${av.slot_hora}`);
                });

                this.notify('dataUpdated');
            } catch (err) {
                console.error('Erro ao carregar dados do Supabase, usando LocalStorage:', err);
                this.loadFromLocalStorage();
            }
        } else {
            this.loadFromLocalStorage();
        }
    }

    loadFromLocalStorage() {
        const savedProfiles = localStorage.getItem('agenda_perfis');
        this.profiles = savedProfiles ? JSON.parse(savedProfiles) : [];

        const savedAvail = localStorage.getItem('agenda_availabilities');
        if (savedAvail) {
            const parsed = JSON.parse(savedAvail);
            this.availabilities = {};
            for (const key in parsed) {
                this.availabilities[key] = new Set(parsed[key]);
            }
        } else {
            this.availabilities = {};
        }

        this.notify('dataUpdated');
    }

    async saveToLocalStorage() {
        localStorage.setItem('agenda_perfis', JSON.stringify(this.profiles));
        const serializeAvail = {};
        for (const key in this.availabilities) {
            serializeAvail[key] = Array.from(this.availabilities[key]);
        }
        localStorage.setItem('agenda_availabilities', JSON.stringify(serializeAvail));
    }

    // ==========================================================================
    // OPERAÇÕES DE PERFIL
    // ==========================================================================
    async addProfile(name, color) {
        const id     = 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const avatar = name.charAt(0).toUpperCase();
        const newProfile = { id, nome: name, cor: color, avatar };

        this.profiles.push(newProfile);

        if (this.isSupabaseConnected) {
            try {
                await this._upsert('agenda_perfis', { id, nome: name, cor: color, avatar });
            } catch (err) {
                console.error('Erro ao inserir perfil no Supabase:', err);
            }
        }

        await this.saveToLocalStorage();
        this.notify('dataUpdated');
        return newProfile;
    }

    async updateProfile(id, name, color) {
        const profile = this.profiles.find(p => p.id === id);
        if (!profile) return;

        profile.nome   = name;
        profile.cor    = color;
        profile.avatar = name.charAt(0).toUpperCase();

        if (this.isSupabaseConnected) {
            try {
                await this._patch('agenda_perfis', `id=eq.${id}`, {
                    nome:   name,
                    cor:    color,
                    avatar: profile.avatar
                });
            } catch (err) {
                console.error('Erro ao atualizar perfil no Supabase:', err);
            }
        }

        await this.saveToLocalStorage();
        this.notify('dataUpdated');
    }

    async deleteProfile(id) {
        this.profiles = this.profiles.filter(p => p.id !== id);
        for (const key in this.availabilities) {
            if (key.startsWith(id + '_')) delete this.availabilities[key];
        }

        if (this.isSupabaseConnected) {
            try {
                await this._delete('agenda_disponibilidade', `perfil_id=eq.${id}`);
                await this._delete('agenda_perfis', `id=eq.${id}`);
            } catch (err) {
                console.error('Erro ao deletar perfil no Supabase:', err);
            }
        }

        await this.saveToLocalStorage();
        this.notify('dataUpdated');
    }

    getProfiles() { return this.profiles; }

    // ==========================================================================
    // OPERAÇÕES DE DISPONIBILIDADE
    // ==========================================================================
    isAvailable(profileId, day, slot) {
        const key = `${profileId}_${this.weekRef}`;
        return this.availabilities[key] && this.availabilities[key].has(`${day}_${slot}`);
    }

    getProfilesAvailableAt(day, slot) {
        return this.profiles.filter(p => this.isAvailable(p.id, day, slot));
    }

    setAvailabilityLocal(profileId, day, slot, available) {
        const key = `${profileId}_${this.weekRef}`;
        if (!this.availabilities[key]) this.availabilities[key] = new Set();
        const slotKey = `${day}_${slot}`;
        if (available) this.availabilities[key].add(slotKey);
        else           this.availabilities[key].delete(slotKey);
    }

    async syncAvailabilityLocalChanges(profileId, changes) {
        await this.saveToLocalStorage();

        if (this.isSupabaseConnected && changes.length > 0) {
            try {
                const toAdd    = changes.filter(c =>  c.available);
                const toRemove = changes.filter(c => !c.available);
                const promises = [];

                if (toAdd.length > 0) {
                    // Upsert em lote — envia array
                    const rows = toAdd.map(c => ({
                        perfil_id:   profileId,
                        semana_ref:  this.weekRef,
                        dia_semana:  c.day,
                        slot_hora:   c.slot
                    }));
                    promises.push(this._upsert('agenda_disponibilidade', rows));
                }

                toRemove.forEach(c => {
                    promises.push(
                        this._delete(
                            'agenda_disponibilidade',
                            `perfil_id=eq.${profileId}&semana_ref=eq.${this.weekRef}&dia_semana=eq.${c.day}&slot_hora=eq.${c.slot}`
                        )
                    );
                });

                if (promises.length > 0) await Promise.all(promises);
            } catch (err) {
                console.error('Erro ao sincronizar disponibilidades no Supabase:', err);
            }
        }

        this.notify('dataUpdated');
    }
}
