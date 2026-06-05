export class View {
    constructor() {
        // Cores disponíveis para perfis
        this.presetColors = [
            '#6366f1', // Indigo (Padrão)
            '#ec4899', // Pink
            '#10b981', // Green
            '#f59e0b', // Amber/Yellow
            '#3b82f6', // Blue
            '#8b5cf6', // Purple
            '#ef4444', // Red
            '#06b6d4', // Cyan
            '#84cc16', // Lime
            '#f97316', // Orange
            '#14b8a6', // Teal
            '#64748b'  // Slate/Gray
        ];

        // Elementos DOM Cacheados
        this.currentWeekLabel = document.getElementById('current-week-label');
        this.currentWeekRange = document.getElementById('current-week-range');
        this.prevWeekBtn = document.getElementById('prev-week-btn');
        this.nextWeekBtn = document.getElementById('next-week-btn');
        this.todayBtn = document.getElementById('today-btn');
        this.themeToggleBtn = document.getElementById('theme-toggle-btn');
        this.dbStatusBadge = document.getElementById('db-status-badge');
        this.configDbBtn = document.getElementById('config-db-btn');
        
        this.profilesList = document.getElementById('profiles-list');
        this.addProfileBtn = document.getElementById('add-profile-btn');
        this.activeProfileBanner = document.getElementById('active-profile-banner');
        
        this.calendarGridHeader = document.getElementById('calendar-header-days');
        this.calendarGridBody = document.getElementById('calendar-grid-body');
        this.calendarScroll = document.getElementById('calendar-grid-scroll');
        
        this.compatibilityList = document.getElementById('compatibility-list');
        this.compatibilityChips = document.querySelectorAll('.compatibility-filters .filter-chip');
        this.summaryTableBody = document.getElementById('summary-table-body');
        this.summaryTotal = document.getElementById('summary-total');
        
        this.statTotalProfiles = document.getElementById('stat-total-profiles');
        this.statTotalHours = document.getElementById('stat-total-hours');
        this.statPopularSlot = document.getElementById('stat-popular-slot');
        this.statPopularDay = document.getElementById('stat-popular-day');
        this.svgChartContainer = document.getElementById('svg-chart-container');
        
        // Modais e Popover
        this.dbConfigModal = document.getElementById('db-config-modal');
        this.dbConfigForm = document.getElementById('db-config-form');
        this.dbConnectionString = document.getElementById('db-connection-string');
        this.dbModalClose = document.getElementById('db-modal-close');
        this.dbDisconnectBtn = document.getElementById('db-disconnect-btn');
        this.dbTestBtn = document.getElementById('db-test-btn');
        this.dbTestResult = document.getElementById('db-test-result');
        this.toggleConnVisibility = document.getElementById('toggle-conn-visibility');
        
        this.profileModal = document.getElementById('profile-modal');
        this.profileForm = document.getElementById('profile-form');
        this.profileIdInput = document.getElementById('profile-id');
        this.profileNameInput = document.getElementById('profile-name');
        this.profileColorInput = document.getElementById('profile-color');
        this.profileModalTitle = document.getElementById('profile-modal-title');
        this.profileModalClose = document.getElementById('profile-modal-close');
        this.profileDeleteBtn = document.getElementById('profile-delete-btn');
        this.colorPalette = document.getElementById('color-palette');
        this.avatarPreview = document.getElementById('avatar-preview');
        
        this.cellPopover = document.getElementById('cell-popover');
        this.popoverTime = document.getElementById('popover-time');
        this.popoverList = document.getElementById('popover-list');

        // Estado interno da View
        this.selectedProfileId = null;
        this.compatibilityFilter = 'all'; // 'all', '100', '80'
        
        // Renderizar paleta de cores estática no Modal de Perfil
        this.renderColorPalette();
        this.setupViewEventListeners();
    }

    // ==========================================================================
    // INICIALIZAÇÃO E EVENT LISTENERS DE VIEW
    // ==========================================================================
    setupViewEventListeners() {
        // Alternador de Visibilidade da String de Conexão
        this.toggleConnVisibility.addEventListener('click', () => {
            const isPassword = this.dbConnectionString.type === 'password';
            this.dbConnectionString.type = isPassword ? 'text' : 'password';
            const icon = this.toggleConnVisibility.querySelector('i');
            icon.className = isPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
        });

        // Fechar Modais no Overlay
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.closeModal(overlay.id);
                }
            });
        });

        // Atualizar avatar preview ao digitar nome no modal de perfil
        this.profileNameInput.addEventListener('input', () => {
            const name = this.profileNameInput.value.trim();
            this.avatarPreview.textContent = name ? name.charAt(0).toUpperCase() : '?';
        });
    }

    // Renderiza os círculos de cores selecionáveis no modal do perfil
    renderColorPalette() {
        this.colorPalette.innerHTML = '';
        this.presetColors.forEach(color => {
            const option = document.createElement('div');
            option.className = 'color-option';
            option.style.backgroundColor = color;
            option.dataset.color = color;
            
            option.addEventListener('click', () => {
                document.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
                this.profileColorInput.value = color;
                this.avatarPreview.style.backgroundColor = color;
            });
            
            this.colorPalette.appendChild(option);
        });
    }

    // ==========================================================================
    // CONTROLE DE MODAIS
    // ==========================================================================
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            
            // Limpa mensagens se for o modal do banco
            if (modalId === 'db-config-modal') {
                this.dbTestResult.className = 'test-result-box hidden';
                this.dbTestResult.textContent = '';
            }
        }
    }

    // Preenche e abre o modal de perfil
    openProfileModal(profile = null) {
        this.profileForm.reset();
        
        if (profile) {
            this.profileModalTitle.innerHTML = '<i class="fa-solid fa-user-gear"></i> Editar Perfil';
            this.profileIdInput.value = profile.id;
            this.profileNameInput.value = profile.nome;
            this.profileColorInput.value = profile.cor;
            this.avatarPreview.textContent = profile.avatar;
            this.avatarPreview.style.backgroundColor = profile.cor;
            this.profileDeleteBtn.classList.remove('hidden');
            
            // Seleciona a cor correta na paleta
            document.querySelectorAll('.color-option').forEach(opt => {
                if (opt.dataset.color.toLowerCase() === profile.cor.toLowerCase()) {
                    opt.classList.add('selected');
                } else {
                    opt.classList.remove('selected');
                }
            });
        } else {
            this.profileModalTitle.innerHTML = '<i class="fa-solid fa-user-plus"></i> Novo Perfil';
            this.profileIdInput.value = '';
            this.profileDeleteBtn.classList.add('hidden');
            this.avatarPreview.textContent = '?';
            
            // Seleciona a primeira cor por padrão
            const firstColor = this.presetColors[0];
            this.profileColorInput.value = firstColor;
            this.avatarPreview.style.backgroundColor = firstColor;
            
            document.querySelectorAll('.color-option').forEach((opt, idx) => {
                if (idx === 0) opt.classList.add('selected');
                else opt.classList.remove('selected');
            });
        }
        
        this.openModal('profile-modal');
    }

    // Preenche e abre o modal de banco de dados
    openDbModal(connString) {
        this.dbConnectionString.value = connString;
        this.openModal('db-config-modal');
    }

    // Mostra feedback de teste de banco no modal
    showDbTestResult(success, message) {
        this.dbTestResult.classList.remove('hidden');
        if (success) {
            this.dbTestResult.className = 'test-result-box success';
            this.dbTestResult.innerHTML = `<i class="fa-solid fa-circle-check"></i> Conectado com sucesso!`;
        } else {
            this.dbTestResult.className = 'test-result-box error';
            this.dbTestResult.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> Erro: ${message}`;
        }
    }

    // ==========================================================================
    // RENDERIZAÇÃO DA GRADE DE HORÁRIOS (GRID)
    // ==========================================================================
    // Cria o esqueleto do Grid de horários (48 linhas de 30 min cada)
    renderGridSkeleton() {
        this.calendarGridBody.innerHTML = '';
        
        for (let slot = 0; slot < 48; slot++) {
            const hour = Math.floor(slot / 2);
            const minute = (slot % 2) * 30;
            const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
            
            const row = document.createElement('div');
            row.className = 'calendar-row';
            
            const timeCell = document.createElement('div');
            timeCell.className = 'time-cell';
            timeCell.textContent = timeStr;
            row.appendChild(timeCell);
            
            for (let day = 0; day < 7; day++) {
                const cell = document.createElement('div');
                cell.className = 'calendar-cell';
                cell.dataset.day = day;
                cell.dataset.slot = slot;
                row.appendChild(cell);
            }
            
            this.calendarGridBody.appendChild(row);
        }
    }

    // Atualiza os dias e datas no cabeçalho do Grid
    renderGridHeader(weekDays) {
        const dayHeaders = this.calendarGridHeader.querySelectorAll('.day-header-cell');
        const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        
        dayHeaders.forEach((header, idx) => {
            const date = weekDays[idx];
            const pad = (n) => String(n).padStart(2, '0');
            const dateStr = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
            
            header.innerHTML = `${diasSemana[idx]} <span class="header-day-num">${dateStr}</span>`;
        });
    }

    // Colore as células com base nas disponibilidades dos perfis
    renderAvailabilities(model) {
        const cells = this.calendarGridBody.querySelectorAll('.calendar-cell');
        
        cells.forEach(cell => {
            const day = parseInt(cell.dataset.day, 10);
            const slot = parseInt(cell.dataset.slot, 10);
            
            // Busca perfis disponíveis nesse bloco
            const availableProfiles = model.getProfilesAvailableAt(day, slot);
            
            cell.innerHTML = ''; // Limpa célula
            
            if (availableProfiles.length === 0) {
                // Ninguém disponível
                cell.style.backgroundColor = '';
            } else if (availableProfiles.length === 1) {
                // Apenas 1 pessoa disponível
                const profile = availableProfiles[0];
                const indicator = document.createElement('div');
                indicator.className = 'cell-availability-indicator';
                indicator.style.backgroundColor = profile.cor;
                indicator.style.opacity = '0.9';
                
                // Exibe as iniciais da pessoa em fonte pequena se a célula for selecionada
                indicator.textContent = profile.avatar;
                
                cell.appendChild(indicator);
            } else {
                // Múltiplas pessoas disponíveis
                const indicator = document.createElement('div');
                indicator.className = 'cell-availability-indicator multi-profile';
                
                // Cria as listras coloridas
                const stripeContainer = document.createElement('div');
                stripeContainer.className = 'multi-color-bar-container';
                
                availableProfiles.forEach(p => {
                    const stripe = document.createElement('div');
                    stripe.className = 'color-stripe';
                    stripe.style.backgroundColor = p.cor;
                    stripeContainer.appendChild(stripe);
                });
                
                indicator.appendChild(stripeContainer);
                
                // Adiciona o selo indicador de quantidade
                const badge = document.createElement('span');
                badge.className = 'multi-badge';
                badge.textContent = `+${availableProfiles.length}`;
                indicator.appendChild(badge);
                
                cell.appendChild(indicator);
            }
        });
    }

    // ==========================================================================
    // RENDERIZAÇÃO DA SIDEBAR DE PERFIS
    // ==========================================================================
    renderProfilesList(profiles) {
        this.profilesList.innerHTML = '';
        
        if (profiles.length === 0) {
            this.profilesList.innerHTML = `<div class="empty-state" style="padding: 10px 0;"><p>Nenhum participante criado. Clique em "Novo" para começar.</p></div>`;
            return;
        }

        profiles.forEach(p => {
            const li = document.createElement('li');
            li.className = 'profile-item';
            if (this.selectedProfileId === p.id) {
                li.classList.add('active');
                li.style.setProperty('--active-border-color', p.cor);
            }

            const clickArea = document.createElement('div');
            clickArea.className = 'profile-clickable';
            clickArea.dataset.id = p.id;
            
            const avatar = document.createElement('div');
            avatar.className = 'avatar';
            avatar.style.backgroundColor = p.cor;
            avatar.textContent = p.avatar;
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'profile-name';
            nameSpan.textContent = p.nome;
            
            clickArea.appendChild(avatar);
            clickArea.appendChild(nameSpan);
            
            const actions = document.createElement('div');
            actions.className = 'profile-actions';
            
            const editBtn = document.createElement('button');
            editBtn.className = 'btn-profile-edit';
            editBtn.innerHTML = '<i class="fa-solid fa-pencil"></i>';
            editBtn.dataset.id = p.id;
            
            actions.appendChild(editBtn);
            
            li.appendChild(clickArea);
            li.appendChild(actions);
            
            this.profilesList.appendChild(li);
        });
    }

    // Atualiza o painel indicando qual perfil está selecionado para pintar
    updateActiveProfileBanner(profiles) {
        const activeProfile = profiles.find(p => p.id === this.selectedProfileId);
        const activeContainer = this.activeProfileBanner.querySelector('.active-profile-info');
        
        if (activeProfile) {
            this.activeProfileBanner.style.borderColor = activeProfile.cor;
            this.activeProfileBanner.style.backgroundColor = `${activeProfile.cor}08`; // Opacidade 3%
            
            activeContainer.innerHTML = `
                <div class="avatar" style="background-color: ${activeProfile.cor}">${activeProfile.avatar}</div>
                <div class="profile-name" style="font-weight: 700; color: ${activeProfile.cor}">${activeProfile.nome}</div>
                <button id="deselect-profile-btn" class="btn-secondary btn-sm" style="margin-left: auto; padding: 4px 8px; font-size: 11px;">Sair</button>
            `;
            this.activeProfileBanner.querySelector('.edit-instructions').style.display = 'block';
        } else {
            this.activeProfileBanner.style.borderColor = '';
            this.activeProfileBanner.style.backgroundColor = '';
            activeContainer.innerHTML = `<div class="profile-none-selected">Nenhum perfil selecionado</div>`;
            this.activeProfileBanner.querySelector('.edit-instructions').style.display = 'none';
        }
    }

    setSelectedProfileId(id) {
        this.selectedProfileId = id;
    }

    getSelectedProfileId() {
        return this.selectedProfileId;
    }

    // ==========================================================================
    // RENDERIZAÇÃO DO RESUMO E COMPATIBILIDADE
    // ==========================================================================
    renderSummaryTable(profiles, model) {
        this.summaryTableBody.innerHTML = '';
        
        if (profiles.length === 0) {
            this.summaryTableBody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">Crie perfis para ver o resumo.</td></tr>`;
            this.summaryTotal.innerHTML = `Total de horas: <strong>0h</strong> | Média: <strong>0%</strong>`;
            return;
        }

        let totalHoursCombined = 0;
        let sumPercentages = 0;

        profiles.forEach(p => {
            const key = `${p.id}_${model.getWeekRef()}`;
            const setSlots = model.availabilities[key];
            const slotCount = setSlots ? setSlots.size : 0;
            const hours = slotCount / 2; // Cada slot de 30m = 0.5 horas
            totalHoursCombined += hours;

            // Porcentagem da semana: total de slots é 7 * 48 = 336
            const percentage = ((slotCount / 336) * 100).toFixed(1);
            sumPercentages += parseFloat(percentage);

            const tr = document.createElement('tr');
            
            const tdName = document.createElement('td');
            tdName.innerHTML = `
                <div class="summary-participant">
                    <span class="dot-indicator" style="background-color: ${p.cor}"></span>
                    <span>${p.nome}</span>
                </div>
            `;
            
            const tdHours = document.createElement('td');
            tdHours.style.fontWeight = '600';
            tdHours.textContent = `${hours}h`;
            
            const tdPct = document.createElement('td');
            tdPct.textContent = `${percentage}%`;
            
            tr.appendChild(tdName);
            tr.appendChild(tdHours);
            tr.appendChild(tdPct);
            
            this.summaryTableBody.appendChild(tr);
        });

        const avgPct = (sumPercentages / profiles.length).toFixed(1);
        this.summaryTotal.innerHTML = `Total cadastrado: <strong>${totalHoursCombined}h</strong> | Média: <strong>${avgPct}%</strong>`;
    }

    // Lógica para renderizar intervalos compatíveis
    renderCompatibilityList(profiles, model) {
        this.compatibilityList.innerHTML = '';
        const total = profiles.length;
        
        if (total === 0) {
            this.compatibilityList.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-circle-info"></i>
                    <p>Adicione participantes e marque disponibilidades para ver horários compatíveis.</p>
                </div>
            `;
            return;
        }

        const diasExtenso = [
            'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
            'Quinta-feira', 'Sexta-feira', 'Sábado'
        ];

        // Dicionário para guardar intervalos agrupados por dia
        // Ex: { 1: [intervalo1, intervalo2] }
        const groupsByDay = {};

        for (let day = 0; day < 7; day++) {
            let current100 = null;
            let current80 = null;
            const dayIntervals = [];

            const addInterval = (start, end, type) => {
                // Contar quem estava disponível em média / no primeiro slot para dar info no popover
                const startHour = Math.floor(start / 2);
                const startMin = (start % 2) * 30;
                const endHour = Math.floor((end + 1) / 2);
                const endMin = ((end + 1) % 2) * 30;
                
                const timeStr = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')} às ${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
                
                dayIntervals.push({
                    start,
                    end,
                    timeStr,
                    type // '100' ou '80'
                });
            };

            for (let slot = 0; slot < 48; slot++) {
                const available = model.getProfilesAvailableAt(day, slot);
                const count = available.length;
                const pct = count / total;

                // 100% de compatibilidade
                if (pct === 1.0) {
                    // Fecha o de 80% se houver
                    if (current80 !== null) {
                        addInterval(current80.start, slot - 1, '80');
                        current80 = null;
                    }
                    if (current100 === null) {
                        current100 = { start: slot };
                    }
                } else {
                    if (current100 !== null) {
                        addInterval(current100.start, slot - 1, '100');
                        current100 = null;
                    }
                }

                // >= 80% e < 100%
                if (pct >= 0.8 && pct < 1.0) {
                    if (current80 === null) {
                        current80 = { start: slot };
                    }
                } else {
                    if (current80 !== null) {
                        addInterval(current80.start, slot - 1, '80');
                        current80 = null;
                    }
                }
            }

            // Fecha no fim do dia
            if (current100 !== null) addInterval(current100.start, 47, '100');
            if (current80 !== null) addInterval(current80.start, 47, '80');

            if (dayIntervals.length > 0) {
                groupsByDay[day] = dayIntervals;
            }
        }

        // Filtra os intervalos e renderiza
        let totalRendered = 0;

        for (let day = 0; day < 7; day++) {
            if (!groupsByDay[day]) continue;

            // Filtra os intervalos deste dia com base no chip ativo
            const filteredIntervals = groupsByDay[day].filter(interval => {
                if (this.compatibilityFilter === 'all') return true;
                if (this.compatibilityFilter === '100') return interval.type === '100';
                if (this.compatibilityFilter === '80') return interval.type === '80';
                return true;
            });

            if (filteredIntervals.length === 0) continue;

            totalRendered += filteredIntervals.length;

            const dayGroup = document.createElement('div');
            dayGroup.className = 'compatibility-day-group';

            const title = document.createElement('div');
            title.className = 'compatibility-day-title';
            title.textContent = diasExtenso[day];
            dayGroup.appendChild(title);

            const list = document.createElement('div');
            list.className = 'compatibility-intervals';

            filteredIntervals.forEach(interval => {
                const card = document.createElement('div');
                card.className = 'interval-card';

                const time = document.createElement('span');
                time.className = 'interval-time';
                time.textContent = interval.timeStr;
                card.appendChild(time);

                const badge = document.createElement('span');
                badge.className = `badge ${interval.type === '100' ? 'badge-green' : 'badge-blue'}`;
                badge.textContent = interval.type === '100' ? '100% Compatível' : '≥ 80% Compatível';
                card.appendChild(badge);

                list.appendChild(card);
            });

            dayGroup.appendChild(list);
            this.compatibilityList.appendChild(dayGroup);
        }

        if (totalRendered === 0) {
            this.compatibilityList.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-calendar-xmark"></i>
                    <p>Nenhum horário compatível encontrado para o filtro selecionado.</p>
                </div>
            `;
        }
    }

    setCompatibilityFilter(filter) {
        this.compatibilityFilter = filter;
        this.compatibilityChips.forEach(chip => {
            if (chip.dataset.filter === filter) {
                chip.classList.add('active');
            } else {
                chip.classList.remove('active');
            }
        });
    }

    // ==========================================================================
    // RENDERIZAÇÃO DE ESTATÍSTICAS E GRÁFICO SVG
    // ==========================================================================
    renderStatistics(profiles, model) {
        const totalProfiles = profiles.length;
        this.statTotalProfiles.textContent = totalProfiles;

        if (totalProfiles === 0) {
            this.statTotalHours.textContent = '0h';
            this.statPopularSlot.textContent = '-';
            this.statPopularDay.textContent = '-';
            this.renderEmptyChart();
            return;
        }

        // Calcula total de horas acumuladas
        let totalSlotsCount = 0;
        const slotsCountByDay = Array(7).fill(0); // índice 0=Dom ... 6=Sáb
        const slotFrequency = Array(48).fill(0); // frequência de cada horário

        profiles.forEach(p => {
            const key = `${p.id}_${model.getWeekRef()}`;
            const setSlots = model.availabilities[key];
            if (setSlots) {
                totalSlotsCount += setSlots.size;
                setSlots.forEach(s => {
                    const [day, slot] = s.split('_').map(Number);
                    slotsCountByDay[day]++;
                    slotFrequency[slot]++;
                });
            }
        });

        // 1. Total Horas
        this.statTotalHours.textContent = `${totalSlotsCount / 2}h`;

        // 2. Horário Mais Popular (Pico)
        let maxFreq = 0;
        let peakSlotIdx = -1;
        for (let i = 0; i < 48; i++) {
            if (slotFrequency[i] > maxFreq) {
                maxFreq = slotFrequency[i];
                peakSlotIdx = i;
            }
        }

        if (peakSlotIdx !== -1 && maxFreq > 0) {
            const hour = Math.floor(peakSlotIdx / 2);
            const min = (peakSlotIdx % 2) * 30;
            const timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
            // Porcentagem de aderência
            const adherence = Math.round((maxFreq / totalProfiles) * 100);
            this.statPopularSlot.textContent = `${timeStr} (${adherence}%)`;
        } else {
            this.statPopularSlot.textContent = '-';
        }

        // 3. Dia Mais Disponível
        let maxDayFreq = 0;
        let bestDayIdx = -1;
        for (let d = 0; d < 7; d++) {
            if (slotsCountByDay[d] > maxDayFreq) {
                maxDayFreq = slotsCountByDay[d];
                bestDayIdx = d;
            }
        }

        const diasExtensoCurto = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        if (bestDayIdx !== -1 && maxDayFreq > 0) {
            this.statPopularDay.textContent = diasExtensoCurto[bestDayIdx];
        } else {
            this.statPopularDay.textContent = '-';
        }

        // 4. Desenha o Gráfico SVG com base nas horas disponíveis de cada dia
        // Converte slots dos dias para horas (dividir por 2)
        const hoursByDay = slotsCountByDay.map(slots => slots / 2);
        this.renderSVGChart(hoursByDay);
    }

    renderEmptyChart() {
        this.svgChartContainer.innerHTML = `
            <div style="height: 100%; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 11px;">
                Sem dados de gráfico
            </div>
        `;
    }

    renderSVGChart(hoursData) {
        const maxVal = Math.max(...hoursData, 1); // evita divisão por zero
        
        // Configurações do SVG
        const svgWidth = 280;
        const svgHeight = 110;
        const paddingLeft = 30;
        const paddingRight = 10;
        const paddingTop = 15;
        const paddingBottom = 20;
        
        const chartWidth = svgWidth - paddingLeft - paddingRight;
        const chartHeight = svgHeight - paddingTop - paddingBottom;
        
        const daysLabels = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
        const colors = ['#6366f1', '#6366f1', '#6366f1', '#6366f1', '#6366f1', '#6366f1', '#6366f1'];
        
        // Inicia montagem do SVG
        let svgHTML = `<svg width="100%" height="100%" viewBox="0 0 ${svgWidth} ${svgHeight}" style="font-family: var(--font-primary);">`;
        
        // Linhas de grade horizontal (3 linhas de referência)
        for (let i = 0; i <= 2; i++) {
            const y = paddingTop + (chartHeight * i / 2);
            const val = ((maxVal * (2 - i)) / 2).toFixed(1);
            
            svgHTML += `
                <line x1="${paddingLeft}" y1="${y}" x2="${svgWidth - paddingRight}" y2="${y}" stroke="var(--border-color)" stroke-width="1" stroke-dasharray="2 2" />
                <text x="${paddingLeft - 5}" y="${y + 4}" font-size="8" fill="var(--text-muted)" text-anchor="end">${val}h</text>
            `;
        }
        
        // Desenha as barras e os rótulos X
        const barSpacing = chartWidth / 7;
        const barWidth = barSpacing * 0.6;
        
        hoursData.forEach((val, idx) => {
            const barHeight = (val / maxVal) * chartHeight;
            const x = paddingLeft + (idx * barSpacing) + (barSpacing - barWidth) / 2;
            const y = paddingTop + chartHeight - barHeight;
            
            // Desenha a barra com cantos arredondados (rx)
            svgHTML += `
                <rect x="${x}" y="${y}" width="${barWidth}" height="${Math.max(barHeight, 2)}" rx="3" fill="var(--accent)" opacity="0.85">
                    <title>${daysLabels[idx]}: ${val} horas</title>
                </rect>
                <text x="${x + barWidth / 2}" y="${svgHeight - 4}" font-size="9" fill="var(--text-secondary)" text-anchor="middle" font-weight="600">${daysLabels[idx]}</text>
            `;
            
            // Valor no topo da barra (se houver altura suficiente)
            if (val > 0) {
                svgHTML += `
                    <text x="${x + barWidth / 2}" y="${y - 4}" font-size="8" fill="var(--text-primary)" text-anchor="middle" font-weight="500">${val}h</text>
                `;
            }
        });
        
        svgHTML += `</svg>`;
        this.svgChartContainer.innerHTML = svgHTML;
    }

    // ==========================================================================
    // POPOVER FLUTUANTE DA CÉLULA (DETALHES)
    // ==========================================================================
    showCellPopover(e, cell, availableProfiles) {
        if (availableProfiles.length === 0) {
            this.hideCellPopover();
            return;
        }

        const slot = parseInt(cell.dataset.slot, 10);
        const day = parseInt(cell.dataset.day, 10);
        const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        
        // Hora formatada
        const startHour = Math.floor(slot / 2);
        const startMin = (slot % 2) * 30;
        const endHour = Math.floor((slot + 1) / 2);
        const endMin = ((slot + 1) % 2) * 30;
        const pad = (n) => String(n).padStart(2, '0');
        const timeStr = `${diasSemana[day]} • ${pad(startHour)}:${pad(startMin)} - ${pad(endHour)}:${pad(endMin)}`;

        this.popoverTime.textContent = timeStr;
        
        this.popoverList.innerHTML = '';
        availableProfiles.forEach(p => {
            const li = document.createElement('li');
            li.className = 'popover-item';
            li.innerHTML = `
                <span class="dot-indicator" style="background-color: ${p.cor}"></span>
                <span>${p.nome}</span>
            `;
            this.popoverList.appendChild(li);
        });

        // Posicionamento do Popover
        const cellRect = cell.getBoundingClientRect();
        const scrollContainerRect = this.calendarScroll.getBoundingClientRect();
        
        // Mostra o popover para poder ler as dimensões
        this.cellPopover.classList.add('active');
        const popoverRect = this.cellPopover.getBoundingClientRect();
        
        // Posiciona o popover acima da célula
        let top = cellRect.top - popoverRect.height - 8;
        let left = cellRect.left + (cellRect.width / 2) - (popoverRect.width / 2);
        
        // Ajusta se sair das margens do calendário
        if (left < scrollContainerRect.left) {
            left = scrollContainerRect.left + 8;
        } else if (left + popoverRect.width > scrollContainerRect.right) {
            left = scrollContainerRect.right - popoverRect.width - 8;
        }
        
        if (top < scrollContainerRect.top) {
            // Se não houver espaço em cima, joga para baixo da célula
            top = cellRect.bottom + 8;
        }

        this.cellPopover.style.top = `${top + window.scrollY}px`;
        this.cellPopover.style.left = `${left + window.scrollX}px`;
    }

    hideCellPopover() {
        this.cellPopover.classList.remove('active');
    }

    // ==========================================================================
    // TEMA CLARO E ESCURO
    // ==========================================================================
    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        const icon = this.themeToggleBtn.querySelector('i');
        if (theme === 'dark') {
            icon.className = 'fa-solid fa-sun';
            this.themeToggleBtn.title = 'Alternar para Modo Claro';
        } else {
            icon.className = 'fa-solid fa-moon';
            this.themeToggleBtn.title = 'Alternar para Modo Escuro';
        }
    }

    // ==========================================================================
    // CABEÇALHO DO BANCO DE DADOS
    // ==========================================================================
    updateDbStatus(status, errorMsg = '') {
        this.dbStatusBadge.className = `status-badge ${status}`;
        const statusText = this.dbStatusBadge.querySelector('.status-text');
        
        if (status === 'postgres') {
            statusText.textContent = 'Vercel Postgres';
            this.dbStatusBadge.title = 'Conectado ao Vercel Postgres em tempo real. Clique para alterar.';
        } else {
            statusText.textContent = 'Modo Local';
            this.dbStatusBadge.title = errorMsg 
                ? `Erro de conexão: ${errorMsg}. Usando LocalStorage. Clique para configurar.`
                : 'Salvando apenas localmente neste navegador. Clique para conectar ao Postgres.';
        }
    }
}
