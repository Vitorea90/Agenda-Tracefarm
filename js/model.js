// Importação do Neon Serverless Driver para Postgres sobre HTTP
// Usamos a versão do esm.sh que resolve as dependências para o navegador
import { neon } from 'https://esm.sh/@neondatabase/serverless@0.9.0';

export class Model {
    constructor() {
        this.listeners = {};
        this.profiles = []; // Array de { id, nome, cor, avatar }
        this.availabilities = {}; // Objeto chaveado por perfilId_semanaRef: Set de "dia_slot" (ex: "1_16" -> Segunda às 08:00)
        
        // Configurações do Banco de Dados
        this.connectionString = localStorage.getItem('agenda_db_conn') || '';
        this.isPostgresConnected = false;
        this.sql = null;
        
        // Estado da semana
        // Carrega o offset da semana anterior ou inicia em 0 (semana atual)
        const savedOffset = localStorage.getItem('agenda_week_offset');
        this.weekOffset = savedOffset !== null ? parseInt(savedOffset, 10) : 0;
        
        // Determinar a semana de referência atual
        this.updateWeekDays();
    }

    // ==========================================================================
    // SISTEMA DE EVENTOS (OBSERVER PATTERN)
    // ==========================================================================
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    notify(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    }

    // ==========================================================================
    // LÓGICA DE DATAS E SEMANA
    // ==========================================================================
    updateWeekDays() {
        const today = new Date();
        // Ajusta para o meio-dia para evitar problemas de fuso horário / horário de verão
        today.setHours(12, 0, 0, 0);
        
        // Encontra o domingo da semana atual (0 = Domingo)
        const currentSunday = new Date(today);
        currentSunday.setDate(today.getDate() - today.getDay());
        
        // Aplica o offset de semanas
        this.currentSunday = new Date(currentSunday);
        this.currentSunday.setDate(currentSunday.getDate() + (this.weekOffset * 7));
        
        // Gera os 7 dias da semana (Domingo a Sábado)
        this.weekDays = [];
        for (let i = 0; i < 7; i++) {
            const day = new Date(this.currentSunday);
            day.setDate(this.currentSunday.getDate() + i);
            this.weekDays.push(day);
        }
        
        // String de referência da semana: "AAAA-MM-DD" do domingo
        this.weekRef = this.formatDateISO(this.currentSunday);
        
        // Salva o offset
        localStorage.setItem('agenda_week_offset', this.weekOffset);
    }

    getWeekDays() {
        return this.weekDays;
    }

    getWeekRef() {
        return this.weekRef;
    }

    // Retorna o rótulo estilizado da semana e intervalo de datas
    // Ex: "1ª Semana de Junho" e "(31/05 a 06/06)"
    getWeekLabels() {
        const sunday = this.weekDays[0];
        const saturday = this.weekDays[6];
        
        // O mês de referência da semana será o mês do sábado (conforme regra da maior parte da semana / fim de semana)
        const refMonth = saturday.getMonth();
        const refYear = saturday.getFullYear();
        
        // Nomes dos meses em português
        const meses = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        
        // Calcula qual semana do mês é (1ª, 2ª, 3ª, etc) com base no sábado
        // Conta quantos sábados do mesmo mês existem antes ou no mesmo dia que este sábado
        let saturdayCount = 0;
        const tempDate = new Date(saturday);
        while (tempDate.getMonth() === refMonth) {
            saturdayCount++;
            tempDate.setDate(tempDate.getDate() - 7);
        }
        
        const weekName = `${saturdayCount}ª Semana de ${meses[refMonth]}`;
        
        // Formata intervalo (DD/MM)
        const pad = (n) => String(n).padStart(2, '0');
        const rangeStr = `(${pad(sunday.getDate())}/${pad(sunday.getMonth() + 1)} a ${pad(saturday.getDate())}/${pad(saturday.getMonth() + 1)})`;
        
        return {
            title: weekName,
            range: rangeStr,
            year: refYear
        };
    }

    changeWeek(direction) {
        if (direction === 'next') {
            this.weekOffset += 1;
        } else if (direction === 'prev') {
            this.weekOffset -= 1;
        } else if (direction === 'today') {
            this.weekOffset = 0;
        }
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
    // PERSISTÊNCIA & CONEXÃO (LOCALSTORAGE / VERCEL POSTGRES)
    // ==========================================================================
    async init() {
        if (this.connectionString) {
            try {
                // Tenta inicializar a conexão Postgres
                this.sql = neon(this.connectionString);
                await this.createTables();
                this.isPostgresConnected = true;
                this.notify('dbStatusChanged', { status: 'postgres' });
            } catch (err) {
                console.error("Falha ao conectar ao Postgres, usando LocalStorage como fallback:", err);
                this.isPostgresConnected = false;
                this.sql = null;
                this.notify('dbStatusChanged', { status: 'local', error: err.message });
            }
        } else {
            this.isPostgresConnected = false;
            this.sql = null;
            this.notify('dbStatusChanged', { status: 'local' });
        }

        await this.loadData();
    }

    async setConnectionString(connStr) {
        if (connStr) {
            try {
                const testSql = neon(connStr);
                // Executa uma query de teste simples
                await testSql`SELECT 1 as connected`;
                
                this.connectionString = connStr;
                localStorage.setItem('agenda_db_conn', connStr);
                this.sql = testSql;
                this.isPostgresConnected = true;
                
                await this.createTables();
                this.notify('dbStatusChanged', { status: 'postgres' });
                await this.loadData();
                return { success: true };
            } catch (err) {
                return { success: false, error: err.message };
            }
        } else {
            // Disconectar
            this.connectionString = '';
            localStorage.removeItem('agenda_db_conn');
            this.sql = null;
            this.isPostgresConnected = false;
            this.notify('dbStatusChanged', { status: 'local' });
            await this.loadData();
            return { success: true };
        }
    }

    async testConnection(connStr) {
        try {
            const testSql = neon(connStr);
            await testSql`SELECT 1 as connected`;
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    async createTables() {
        if (!this.sql) return;
        
        // Criação da tabela de perfis
        await this.sql`
            CREATE TABLE IF NOT EXISTS agenda_perfis (
                id VARCHAR(50) PRIMARY KEY,
                nome VARCHAR(100) NOT NULL,
                cor VARCHAR(20) NOT NULL,
                avatar VARCHAR(10) NOT NULL
            )
        `;

        // Criação da tabela de disponibilidades
        await this.sql`
            CREATE TABLE IF NOT EXISTS agenda_disponibilidade (
                perfil_id VARCHAR(50) NOT NULL,
                semana_ref VARCHAR(20) NOT NULL,
                dia_semana INTEGER NOT NULL,
                slot_hora INTEGER NOT NULL,
                PRIMARY KEY (perfil_id, semana_ref, dia_semana, slot_hora)
            )
        `;
    }

    async loadData() {
        if (this.isPostgresConnected && this.sql) {
            try {
                // Carrega perfis do Postgres
                const dbProfiles = await this.sql`SELECT id, nome, cor, avatar FROM agenda_perfis`;
                this.profiles = dbProfiles.map(p => ({
                    id: p.id,
                    nome: p.nome,
                    cor: p.cor,
                    avatar: p.avatar
                }));

                // Carrega disponibilidades da semana atual do Postgres
                const dbAvail = await this.sql`
                    SELECT perfil_id, dia_semana, slot_hora 
                    FROM agenda_disponibilidade 
                    WHERE semana_ref = ${this.weekRef}
                `;
                
                // Limpa e reconstrói cache de disponibilidade para a semana atual
                this.availabilities = {};
                dbAvail.forEach(av => {
                    const key = `${av.perfil_id}_${this.weekRef}`;
                    if (!this.availabilities[key]) {
                        this.availabilities[key] = new Set();
                    }
                    this.availabilities[key].add(`${av.dia_semana}_${av.slot_hora}`);
                });

                this.notify('dataUpdated');
            } catch (err) {
                console.error("Erro ao carregar dados do Postgres, usando LocalStorage fallback:", err);
                this.loadFromLocalStorage();
            }
        } else {
            this.loadFromLocalStorage();
        }
    }

    loadFromLocalStorage() {
        // Perfis
        const savedProfiles = localStorage.getItem('agenda_perfis');
        this.profiles = savedProfiles ? JSON.parse(savedProfiles) : [];

        // Disponibilidades
        const savedAvail = localStorage.getItem('agenda_availabilities');
        if (savedAvail) {
            const parsed = JSON.parse(savedAvail);
            // Converte arrays de volta para Sets
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
        
        // Converte Sets para Arrays para serialização JSON
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
        const id = 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const avatar = name.charAt(0).toUpperCase();
        const newProfile = { id, nome: name, cor: color, avatar };

        this.profiles.push(newProfile);

        if (this.isPostgresConnected && this.sql) {
            try {
                await this.sql`
                    INSERT INTO agenda_perfis (id, nome, cor, avatar) 
                    VALUES (${id}, ${name}, ${color}, ${avatar})
                `;
            } catch (err) {
                console.error("Erro ao inserir perfil no Postgres, salvando localmente:", err);
            }
        }
        
        await this.saveToLocalStorage();
        this.notify('dataUpdated');
        return newProfile;
    }

    async updateProfile(id, name, color) {
        const profile = this.profiles.find(p => p.id === id);
        if (!profile) return;

        profile.nome = name;
        profile.cor = color;
        profile.avatar = name.charAt(0).toUpperCase();

        if (this.isPostgresConnected && this.sql) {
            try {
                await this.sql`
                    UPDATE agenda_perfis 
                    SET nome = ${name}, cor = ${color}, avatar = ${profile.avatar} 
                    WHERE id = ${id}
                `;
            } catch (err) {
                console.error("Erro ao atualizar perfil no Postgres, salvando localmente:", err);
            }
        }

        await this.saveToLocalStorage();
        this.notify('dataUpdated');
    }

    async deleteProfile(id) {
        this.profiles = this.profiles.filter(p => p.id !== id);
        
        // Remove disponibilidades locais deste perfil
        for (const key in this.availabilities) {
            if (key.startsWith(id + '_')) {
                delete this.availabilities[key];
            }
        }

        if (this.isPostgresConnected && this.sql) {
            try {
                // Delete cascateia para disponibilidades se configurado, senão deleta manualmente
                await this.sql`DELETE FROM agenda_disponibilidade WHERE perfil_id = ${id}`;
                await this.sql`DELETE FROM agenda_perfis WHERE id = ${id}`;
            } catch (err) {
                console.error("Erro ao deletar perfil no Postgres, salvando localmente:", err);
            }
        }

        await this.saveToLocalStorage();
        this.notify('dataUpdated');
    }

    getProfiles() {
        return this.profiles;
    }

    // ==========================================================================
    // OPERAÇÕES DE DISPONIBILIDADE
    // ==========================================================================
    // Retorna se um slot está disponível para um perfil específico
    isAvailable(profileId, day, slot) {
        const key = `${profileId}_${this.weekRef}`;
        return this.availabilities[key] && this.availabilities[key].has(`${day}_${slot}`);
    }

    // Retorna array de perfis disponíveis em um determinado dia/slot
    getProfilesAvailableAt(day, slot) {
        return this.profiles.filter(p => this.isAvailable(p.id, day, slot));
    }

    // Altera a disponibilidade (para clique-e-arraste pintar/despintar)
    async setAvailability(profileId, day, slot, available) {
        const key = `${profileId}_${this.weekRef}`;
        if (!this.availabilities[key]) {
            this.availabilities[key] = new Set();
        }

        const slotKey = `${day}_${slot}`;
        const isCurrentlyAvailable = this.availabilities[key].has(slotKey);

        if (available && !isCurrentlyAvailable) {
            this.availabilities[key].add(slotKey);
            
            if (this.isPostgresConnected && this.sql) {
                try {
                    await this.sql`
                        INSERT INTO agenda_disponibilidade (perfil_id, semana_ref, dia_semana, slot_hora) 
                        VALUES (${profileId}, ${this.weekRef}, ${day}, ${slot})
                        ON CONFLICT (perfil_id, semana_ref, dia_semana, slot_hora) DO NOTHING
                    `;
                } catch (err) {
                    console.error("Erro ao salvar disponibilidade no Postgres:", err);
                }
            }
        } else if (!available && isCurrentlyAvailable) {
            this.availabilities[key].delete(slotKey);
            
            if (this.isPostgresConnected && this.sql) {
                try {
                    await this.sql`
                        DELETE FROM agenda_disponibilidade 
                        WHERE perfil_id = ${profileId} 
                          AND semana_ref = ${this.weekRef} 
                          AND dia_semana = ${day} 
                          AND slot_hora = ${slot}
                    `;
                } catch (err) {
                    console.error("Erro ao deletar disponibilidade no Postgres:", err);
                }
            }
        } else {
            return; // Nenhuma mudança necessária
        }

        await this.saveToLocalStorage();
    }

    // Altera a disponibilidade apenas no cache local da memória
    setAvailabilityLocal(profileId, day, slot, available) {
        const key = `${profileId}_${this.weekRef}`;
        if (!this.availabilities[key]) {
            this.availabilities[key] = new Set();
        }

        const slotKey = `${day}_${slot}`;
        if (available) {
            this.availabilities[key].add(slotKey);
        } else {
            this.availabilities[key].delete(slotKey);
        }
    }

    // Sincroniza em lote as alterações de disponibilidade no banco e localstorage
    async syncAvailabilityLocalChanges(profileId, changes) {
        await this.saveToLocalStorage();
        
        if (this.isPostgresConnected && this.sql && changes.length > 0) {
            try {
                const toAdd = changes.filter(c => c.available);
                const toRemove = changes.filter(c => !c.available);
                
                const promises = [];
                
                toAdd.forEach(c => {
                    promises.push(this.sql`
                        INSERT INTO agenda_disponibilidade (perfil_id, semana_ref, dia_semana, slot_hora) 
                        VALUES (${profileId}, ${this.weekRef}, ${c.day}, ${c.slot})
                        ON CONFLICT (perfil_id, semana_ref, dia_semana, slot_hora) DO NOTHING
                    `);
                });
                
                toRemove.forEach(c => {
                    promises.push(this.sql`
                        DELETE FROM agenda_disponibilidade 
                        WHERE perfil_id = ${profileId} 
                          AND semana_ref = ${this.weekRef} 
                          AND dia_semana = ${c.day} 
                          AND slot_hora = ${c.slot}
                    `);
                });
                
                if (promises.length > 0) {
                    await Promise.all(promises);
                }
            } catch (err) {
                console.error("Erro ao sincronizar alterações em lote no Postgres:", err);
            }
        }
        
        this.notify('dataUpdated');
    }
}
