export class Controller {
    constructor(model, view) {
        this.model = model;
        this.view = view;

        // Estado do arrasto no Grid
        this.isDragging = false;
        this.dragMode = null; // 'add' ou 'remove'
        this.draggedSlots = new Set(); // Guarda "dia_slot" já modificados neste arrasto para evitar duplicidade
        this.draggedChangesList = []; // Acumulador de { day, slot, available } para persistência final
        
        // Loop de Sincronização Periódica (Simulando Tempo Real)
        this.syncIntervalId = null;

        this.init();
    }

    async init() {
        // Vincula eventos do Model
        this.model.on('dbStatusChanged', (data) => this.handleDbStatusChanged(data));
        this.model.on('dataUpdated', () => this.handleDataUpdated());
        this.model.on('weekChanged', () => this.handleWeekChanged());

        // Inicializa o Model (conecta DB e carrega dados)
        await this.model.init();

        // Configura o Tema Inicial (Salvo no LocalStorage ou preferência do sistema)
        const savedTheme = localStorage.getItem('agenda_theme') || 'dark';
        this.view.setTheme(savedTheme);

        // Renderiza o esqueleto inicial da grade
        this.view.renderGridSkeleton();
        this.updateWeekUI();

        // Registra Listeners do DOM
        this.setupEventListeners();
        
        // Inicia Sincronização Periódica
        this.startSyncLoop();
    }

    // ==========================================================================
    // SINCRONIZAÇÃO PERIÓDICA (POLLING PARA TEMPO REAL)
    // ==========================================================================
    startSyncLoop() {
        if (this.syncIntervalId) clearInterval(this.syncIntervalId);
        
        // Atualiza a cada 5 segundos se a página estiver ativa
        this.syncIntervalId = setInterval(() => {
            if (document.visibilityState === 'visible') {
                this.model.loadData();
            }
        }, 5000);
    }

    // ==========================================================================
    // TRATADORES DE EVENTOS DO MODEL
    // ==========================================================================
    handleDbStatusChanged(data) {
        this.view.updateDbStatus(data.status, data.error || '');
    }

    handleDataUpdated() {
        const profiles = this.model.getProfiles();
        
        // Mantém a View sincronizada
        this.view.renderProfilesList(profiles);
        this.view.updateActiveProfileBanner(profiles);
        this.view.renderAvailabilities(this.model);
        this.view.renderSummaryTable(profiles, this.model);
        this.view.renderCompatibilityList(profiles, this.model);
        this.view.renderStatistics(profiles, this.model);
    }

    handleWeekChanged() {
        this.updateWeekUI();
    }

    updateWeekUI() {
        const labels = this.model.getWeekLabels();
        this.view.currentWeekLabel.textContent = labels.title;
        this.view.currentWeekRange.textContent = labels.range;
        
        this.view.renderGridHeader(this.model.getWeekDays());
    }

    // ==========================================================================
    // CAPTURA DE EVENTOS DO DOM (INTERAÇÃO DO USUÁRIO)
    // ==========================================================================
    setupEventListeners() {
        // 1. Navegação de Semana
        this.view.prevWeekBtn.addEventListener('click', () => this.model.changeWeek('prev'));
        this.view.nextWeekBtn.addEventListener('click', () => this.model.changeWeek('next'));
        this.view.todayBtn.addEventListener('click', () => this.model.changeWeek('today'));

        // 2. Alternador de Tema
        this.view.themeToggleBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            this.view.setTheme(newTheme);
            localStorage.setItem('agenda_theme', newTheme);
        });

        // 3. Configurações de Banco de Dados
        this.view.configDbBtn.addEventListener('click', () => this.view.openDbModal(this.model.connectionString));
        this.view.dbStatusBadge.addEventListener('click', () => this.view.openDbModal(this.model.connectionString));
        this.view.dbModalClose.addEventListener('click', () => this.view.closeModal('db-config-modal'));
        
        // Testar Conexão
        this.view.dbTestBtn.addEventListener('click', async () => {
            const connStr = this.view.dbConnectionString.value.trim();
            this.view.dbTestBtn.disabled = true;
            this.view.dbTestBtn.textContent = 'Testando...';
            
            const result = await this.model.testConnection(connStr);
            
            this.view.dbTestBtn.disabled = false;
            this.view.dbTestBtn.innerHTML = 'Testar Conexão';
            this.view.showDbTestResult(result.success, result.error || '');
        });

        // Salvar Conexão
        this.view.dbConfigForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const connStr = this.view.dbConnectionString.value.trim();
            const submitBtn = this.view.dbConfigForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Conectando...';

            const result = await this.model.setConnectionString(connStr);

            submitBtn.disabled = false;
            submitBtn.textContent = 'Salvar e Conectar';

            if (result.success) {
                this.view.closeModal('db-config-modal');
            } else {
                this.view.showDbTestResult(false, result.error);
            }
        });

        // Desconectar / Limpar
        this.view.dbDisconnectBtn.addEventListener('click', async () => {
            if (confirm('Deseja realmente desconectar do banco de dados remetendo ao Modo Local?')) {
                await this.model.setConnectionString('');
                this.view.closeModal('db-config-modal');
            }
        });

        // 4. Modais de Perfil
        this.view.addProfileBtn.addEventListener('click', () => this.view.openProfileModal());
        this.view.profileModalClose.addEventListener('click', () => this.view.closeModal('profile-modal'));
        
        // Editar Perfil (Lápis)
        this.view.profilesList.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.btn-profile-edit');
            if (editBtn) {
                const profileId = editBtn.dataset.id;
                const profile = this.model.getProfiles().find(p => p.id === profileId);
                if (profile) this.view.openProfileModal(profile);
                return;
            }

            // Seleção de Perfil para Pintar Disponibilidade
            const clickArea = e.target.closest('.profile-clickable');
            if (clickArea) {
                const profileId = clickArea.dataset.id;
                if (this.view.getSelectedProfileId() === profileId) {
                    // Se clicar no mesmo, desmarca
                    this.view.setSelectedProfileId(null);
                } else {
                    this.view.setSelectedProfileId(profileId);
                }
                this.view.renderProfilesList(this.model.getProfiles());
                this.view.updateActiveProfileBanner(this.model.getProfiles());
            }
        });

        // Botão Sair da Edição de Disponibilidade
        this.view.activeProfileBanner.addEventListener('click', (e) => {
            const deselectBtn = e.target.closest('#deselect-profile-btn');
            if (deselectBtn) {
                this.view.setSelectedProfileId(null);
                this.view.renderProfilesList(this.model.getProfiles());
                this.view.updateActiveProfileBanner(this.model.getProfiles());
            }
        });

        // Salvar Perfil (Submit Form)
        this.view.profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = this.view.profileIdInput.value;
            const name = this.view.profileNameInput.value.trim();
            const color = this.view.profileColorInput.value;

            if (id) {
                await this.model.updateProfile(id, name, color);
            } else {
                const newProfile = await this.model.addProfile(name, color);
                // Seleciona automaticamente o novo perfil para facilitar o uso
                this.view.setSelectedProfileId(newProfile.id);
            }
            
            this.view.closeModal('profile-modal');
        });

        // Excluir Perfil
        this.view.profileDeleteBtn.addEventListener('click', async () => {
            const id = this.view.profileIdInput.value;
            if (confirm('Tem certeza de que deseja excluir este perfil e todas as disponibilidades dele? Esta ação é irreversível.')) {
                if (this.view.getSelectedProfileId() === id) {
                    this.view.setSelectedProfileId(null);
                }
                await this.model.deleteProfile(id);
                this.view.closeModal('profile-modal');
            }
        });

        // 5. Filtros de Compatibilidade
        this.view.compatibilityChips.forEach(chip => {
            chip.addEventListener('click', () => {
                const filter = chip.dataset.filter;
                this.view.setCompatibilityFilter(filter);
                this.view.renderCompatibilityList(this.model.getProfiles(), this.model);
            });
        });

        // 6. EVENTOS DE ARRASTAR E HOVER NO GRID DE AGENDA (DRAG AND DROP)
        // Mousedown na célula do Grid
        this.view.calendarGridBody.addEventListener('mousedown', (e) => {
            const cell = e.target.closest('.calendar-cell');
            if (!cell) return;

            const profileId = this.view.getSelectedProfileId();
            if (!profileId) return; // Ninguém selecionado

            this.isDragging = true;
            this.view.calendarGridBody.classList.add('dragging-active');
            
            const day = parseInt(cell.dataset.day, 10);
            const slot = parseInt(cell.dataset.slot, 10);
            
            // Define o modo do arrasto: se a célula já está marcada para esse usuário, o arrasto desmarca. Senão, marca.
            const currentlyAvailable = this.model.isAvailable(profileId, day, slot);
            this.dragMode = currentlyAvailable ? 'remove' : 'add';
            
            this.draggedSlots.clear();
            this.draggedChangesList = [];

            this.handleCellDragInteraction(profileId, cell, day, slot);
        });

        // Mouseenter nas células do Grid (durante arrasto ou para mostrar popover)
        this.view.calendarGridBody.addEventListener('mouseover', (e) => {
            const cell = e.target.closest('.calendar-cell');
            if (!cell) return;

            const profileId = this.view.getSelectedProfileId();
            const day = parseInt(cell.dataset.day, 10);
            const slot = parseInt(cell.dataset.slot, 10);

            // 1. Se estiver arrastando com perfil ativo
            if (this.isDragging && profileId) {
                this.handleCellDragInteraction(profileId, cell, day, slot);
                return;
            }

            // 2. Se NÃO estiver arrastando, exibe o popover com quem está disponível neste horário
            if (!this.isDragging) {
                const available = this.model.getProfilesAvailableAt(day, slot);
                this.view.showCellPopover(e, cell, available);
            }
        });

        // Mouseleave do Grid para sumir com o popover
        this.view.calendarGridBody.addEventListener('mouseout', (e) => {
            if (e.target.closest('.calendar-cell')) {
                this.view.hideCellPopover();
            }
        });

        // Mouseup global para encerrar arrasto
        window.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.isDragging = false;
                this.view.calendarGridBody.classList.remove('dragging-active');
                
                const profileId = this.view.getSelectedProfileId();
                if (profileId && this.draggedChangesList.length > 0) {
                    // Executa a persistência e atualização final no Model
                    this.model.syncAvailabilityLocalChanges(profileId, this.draggedChangesList);
                }
            }
        });

        // 7. SUPORTE PARA TOUCH SCREEN (MÓVEL)
        this.view.calendarGridBody.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            const target = document.elementFromPoint(touch.clientX, touch.clientY);
            const cell = target ? target.closest('.calendar-cell') : null;
            if (!cell) return;

            const profileId = this.view.getSelectedProfileId();
            if (!profileId) return;

            // Evita comportamento de scroll da tela enquanto arrasta na agenda
            e.preventDefault();

            this.isDragging = true;
            const day = parseInt(cell.dataset.day, 10);
            const slot = parseInt(cell.dataset.slot, 10);
            
            const currentlyAvailable = this.model.isAvailable(profileId, day, slot);
            this.dragMode = currentlyAvailable ? 'remove' : 'add';
            
            this.draggedSlots.clear();
            this.draggedChangesList = [];

            this.handleCellDragInteraction(profileId, cell, day, slot);
        }, { passive: false });

        this.view.calendarGridBody.addEventListener('touchmove', (e) => {
            if (!this.isDragging) return;

            const touch = e.touches[0];
            const target = document.elementFromPoint(touch.clientX, touch.clientY);
            const cell = target ? target.closest('.calendar-cell') : null;
            if (!cell) return;

            const profileId = this.view.getSelectedProfileId();
            if (!profileId) return;

            e.preventDefault();

            const day = parseInt(cell.dataset.day, 10);
            const slot = parseInt(cell.dataset.slot, 10);

            this.handleCellDragInteraction(profileId, cell, day, slot);
        }, { passive: false });

        this.view.calendarGridBody.addEventListener('touchend', () => {
            if (this.isDragging) {
                this.isDragging = false;
                
                const profileId = this.view.getSelectedProfileId();
                if (profileId && this.draggedChangesList.length > 0) {
                    this.model.syncAvailabilityLocalChanges(profileId, this.draggedChangesList);
                }
            }
        });
    }

    // Gerencia o arrasto por cima de cada célula
    handleCellDragInteraction(profileId, cell, day, slot) {
        const slotKey = `${day}_${slot}`;
        
        // Evita reprocessar o mesmo slot durante o mesmo movimento de arrasto
        if (this.draggedSlots.has(slotKey)) return;
        this.draggedSlots.add(slotKey);

        const available = this.dragMode === 'add';
        
        // 1. Atualiza no cache do Model em memória imediatamente
        this.model.setAvailabilityLocal(profileId, day, slot, available);
        
        // 2. Acumula a alteração na lista que será sincronizada no mouseup
        this.draggedChangesList.push({ day, slot, available });
        
        // 3. Atualiza as cores visualmente no Grid imediatamente para feedback de 60fps
        this.view.renderAvailabilities(this.model);
    }
}
