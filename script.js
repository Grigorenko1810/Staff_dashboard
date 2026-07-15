const REFERENCE_CHART_THEME = {
  colors: {
    graphite: '#202020',
    canvasWhite: '#ffffff',
    ash: '#efefef',
    fog: '#f5f5f5',
    ivory: '#ebe6dd',
    steel: '#4d4d4d',
    slate: '#828282',
    mist: '#e8e8e8',
    ember: '#ff682c',
    brass: '#816729'
  },
  font: {
    heading: 'PolySans, Inter Tight, Space Grotesk, system-ui, sans-serif',
    body: 'Inter, system-ui, sans-serif'
  }
};

const StaffCharts = {
  charts: [],
  theme: REFERENCE_CHART_THEME,
  get palette() {
    return this.theme.colors;
  },
  getTooltipOptions() {
    return {
      backgroundColor: this.palette.graphite,
      titleColor: this.palette.canvasWhite,
      bodyColor: this.palette.canvasWhite,
      borderColor: this.palette.graphite,
      borderWidth: 0,
      padding: 12,
      cornerRadius: 0,
      displayColors: false,
      titleFont: { family: this.theme.font.body, size: 12, weight: '500' },
      bodyFont: { family: this.theme.font.body, size: 12, weight: '400' }
    };
  },
  getAxisTicks(maxTicksLimit = 7) {
    return {
      color: this.palette.slate,
      maxTicksLimit,
      font: { family: this.theme.font.body, size: 12, weight: '400' }
    };
  },
  getPaletteSequence() {
    return [this.palette.ember, this.palette.brass, this.palette.graphite, this.palette.slate, this.palette.mist];
  },
  pluralizeHours(count) {
    const n = Math.abs(Math.round(Number(count) || 0));
    const lastTwo = n % 100;
    const last = n % 10;
    if (lastTwo >= 11 && lastTwo <= 14) return 'часов';
    if (last === 1) return 'час';
    if (last >= 2 && last <= 4) return 'часа';
    return 'часов';
  },
  prepareDoughnutData(labels = [], values = [], colors = []) {
    const palette = this.getPaletteSequence();
    const entries = labels.map((label, index) => ({
      label: label || 'Без категории',
      value: Number(values[index]) || 0,
      color: colors[index] || palette[index % palette.length]
    })).filter((entry) => entry.value > 0);

    if (!entries.length) {
      return {
        labels: ['Нет данных'],
        values: [100],
        colors: [this.palette.mist]
      };
    }

    if (entries.length <= 5) {
      return {
        labels: entries.map((entry) => entry.label),
        values: entries.map((entry) => entry.value),
        colors: entries.map((entry, index) => entry.color || palette[index % palette.length])
      };
    }

    const sorted = [...entries].sort((a, b) => b.value - a.value);
    const visible = sorted.slice(0, 4);
    const otherValue = sorted.slice(4).reduce((sum, entry) => sum + entry.value, 0);
    const compactEntries = [...visible, { label: 'Прочее', value: otherValue, color: this.palette.mist }];
    return {
      labels: compactEntries.map((entry) => entry.label),
      values: compactEntries.map((entry) => entry.value),
      colors: compactEntries.map((entry, index) => entry.color || palette[index % palette.length])
    };
  },
  prepareBarData(labels = [], planned = [], actual = []) {
    const planValues = planned.map((value) => Number(value) || 0);
    const factValues = actual.map((value) => Number(value) || 0);
    const hasTotal = labels.some((label) => String(label).toLowerCase() === 'итого');
    if (hasTotal) {
      return {
        labels,
        planned: planValues,
        actual: factValues,
        totalIndex: labels.findIndex((label) => String(label).toLowerCase() === 'итого')
      };
    }
    return {
      labels: [...labels, '', 'Итого'],
      planned: [...planValues, null, Math.round(planValues.reduce((sum, value) => sum + value, 0))],
      actual: [...factValues, null, Math.round(factValues.reduce((sum, value) => sum + value, 0))],
      totalIndex: labels.length + 1
    };
  },
  createDoughnut(canvas, labels, values, colors, options = {}) {
    this.destroyChart(canvas);
    if (typeof Chart === 'undefined') {
      this.renderFallback(canvas, 'Диаграмма');
      return null;
    }
    const prepared = this.prepareDoughnutData(labels, values, colors);
    const fillPercent = Number.isFinite(options.fillPercent) ? Math.max(0, Math.min(100, options.fillPercent)) : null;
    let chartLabels = prepared.labels;
    let chartValues = prepared.values;
    let chartColors = prepared.colors;
    let trackIndex = -1;
    if (fillPercent !== null) {
      const total = chartValues.reduce((sum, value) => sum + value, 0) || 1;
      chartValues = chartValues.map((value) => (value / total) * fillPercent);
      trackIndex = chartValues.length;
      chartLabels = [...chartLabels, 'Свободно'];
      chartValues = [...chartValues, Math.max(0, 100 - fillPercent)];
      chartColors = [...chartColors, this.palette.fog];
    }
    const hoverOffset = trackIndex >= 0 ? chartValues.map((value, index) => index === trackIndex ? 0 : 3) : 3;
    canvas.classList.toggle('chart-frame--donut__canvas--shadowed', trackIndex >= 0);
    const chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: chartLabels,
        datasets: [{
          data: chartValues,
          backgroundColor: chartColors,
          borderWidth: 0,
          borderRadius: 3,
          spacing: 1,
          hoverOffset
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '74%',
        radius: '88%',
        rotation: 0,
        animation: {
          duration: 450,
          easing: 'easeOutQuart'
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...this.getTooltipOptions(),
            filter: trackIndex >= 0 ? (item) => item.dataIndex !== trackIndex : undefined
          }
        },
        elements: {
          arc: { borderWidth: 0 }
        }
      }
    });
    this.charts.push(chart);
    return chart;
  },
  createBar(canvas, labels, planned, actual) {
    this.destroyChart(canvas);
    if (typeof Chart === 'undefined') {
      this.renderFallback(canvas, 'Диаграмма');
      return null;
    }
    const prepared = this.prepareBarData(labels, planned, actual);
    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: prepared.labels,
        datasets: [
          {
            label: 'План',
            data: prepared.planned,
            backgroundColor: (context) => context.dataIndex === prepared.totalIndex ? this.palette.graphite : this.palette.mist,
            borderColor: (context) => context.dataIndex === prepared.totalIndex ? this.palette.graphite : 'transparent',
            borderWidth: (context) => context.dataIndex === prepared.totalIndex ? 1.5 : 0,
            borderRadius: 3,
            barThickness: 22,
            categoryPercentage: 0.65,
            barPercentage: 0.8
          },
          {
            label: 'Факт',
            data: prepared.actual,
            backgroundColor: (context) => context.dataIndex === prepared.totalIndex ? this.palette.ember : this.palette.brass,
            borderColor: (context) => context.dataIndex === prepared.totalIndex ? this.palette.ember : 'transparent',
            borderWidth: (context) => context.dataIndex === prepared.totalIndex ? 1.5 : 0,
            borderRadius: 3,
            barThickness: 22,
            categoryPercentage: 0.65,
            barPercentage: 0.8
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 450,
          easing: 'easeOutQuart'
        },
        layout: {
          padding: { top: 4, right: 8, bottom: 0, left: 0 }
        },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...this.getTooltipOptions(),
            filter: (context) => context.label !== '' && context.parsed.y !== null,
            callbacks: {
              title: (items) => (items && items.length ? (items[0].label || '') : ''),
              label: (context) => {
                const value = Math.round(context.parsed.y || 0);
                const name = context.dataset.label === 'План' ? 'Плановые часы' : 'Фактические часы';
                return `${name}: ${value} ${this.pluralizeHours(value)}`;
              },
              afterBody: (items) => {
                if (!items || !items.length) return '';
                const index = items[0].dataIndex;
                const datasets = items[0].chart.data.datasets;
                const plan = Math.round(Number(datasets[0]?.data?.[index]) || 0);
                const fact = Math.round(Number(datasets[1]?.data?.[index]) || 0);
                const diff = fact - plan;
                const percent = plan > 0 ? Math.round((fact / plan) * 100) : 0;
                return [`Разница: ${diff > 0 ? '+' : ''}${diff} ${this.pluralizeHours(diff)}`, `Процент выполнения: ${percent}%`];
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: this.getAxisTicks(8),
            border: { display: false }
          },
          y: {
            beginAtZero: true,
            grid: {
              color: this.palette.mist,
              lineWidth: 1,
              drawBorder: false,
              borderDash: [2, 4]
            },
            ticks: this.getAxisTicks(6),
            border: { display: false }
          }
        }
      }
    });
    this.charts.push(chart);
    return chart;
  },
  createLine(canvas, labels, values, label) {
    this.destroyChart(canvas);
    if (typeof Chart === 'undefined') {
      this.renderFallback(canvas, 'Диаграмма');
      return null;
    }
    const chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label,
          data: values,
          borderColor: this.palette.ember,
          backgroundColor: 'rgba(255,104,44,0.08)',
          fill: true,
          tension: 0.34,
          borderWidth: 2,
          pointRadius: 2,
          pointHoverRadius: 5,
          pointBackgroundColor: this.palette.canvasWhite,
          pointBorderColor: this.palette.ember,
          pointBorderWidth: 1.5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 450,
          easing: 'easeOutQuart'
        },
        layout: {
          padding: { top: 6, right: 8, bottom: 0, left: 0 }
        },
        plugins: {
          legend: { display: false },
          tooltip: this.getTooltipOptions()
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: this.getAxisTicks(8),
            border: { display: false }
          },
          y: {
            beginAtZero: true,
            suggestedMax: 100,
            ticks: this.getAxisTicks(6),
            grid: {
              color: this.palette.mist,
              lineWidth: 1,
              drawBorder: false,
              borderDash: [2, 4]
            },
            border: { display: false }
          }
        }
      }
    });
    this.charts.push(chart);
    return chart;
  },
  renderFallback(canvas, title) {
    const parent = canvas.parentElement;
    if (!parent) return;
    parent.innerHTML = `<div class="empty-state" style="height:100%;display:grid;place-items:center;">${this.escapeHtml(title)}<br><small>Chart.js недоступен, но интерфейс готов к подключению данных</small></div>`;
  },
  escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },
  destroyChart(canvas) {
    const existing = this.charts.find((chart) => chart.canvas === canvas);
    if (existing) {
      existing.destroy();
      this.charts = this.charts.filter((chart) => chart !== existing);
    }
  },
  getChart(canvas) {
    return this.charts.find((chart) => chart.canvas === canvas) || null;
  },
  updateLine(canvas, labels, values, label) {
    const existing = this.getChart(canvas);
    if (!existing || existing.config?.type !== 'line') {
      return this.createLine(canvas, labels, values, label);
    }
    existing.data.labels = labels;
    existing.data.datasets[0].label = label;
    existing.data.datasets[0].data = values;
    existing.update();
    return existing;
  },
  destroyAll() {
    this.charts.forEach((chart) => chart.destroy());
    this.charts = [];
  }
};

const StaffApp = {
  mockData: window.mockData || {},
  cacheKey: 'staff-analytics-cache',
  state: {
    currentPage: document.body?.dataset?.page || 'dashboard',
    filters: { search: '', centerId: '', managementId: '', status: '' },
    previewEmployeeId: null,
    modalPositions: {},
    employeePeriod: 'week',
    employeeStartDate: '',
    employeeEndDate: '',
    dynamicGranularity: 'weeks',
    dynamics: {
      techBlock: {
        periodPreset: 'year',
        startDate: '',
        endDate: '',
        granularity: 'months'
      },
      center: {
        periodPreset: 'year',
        startDate: '',
        endDate: '',
        granularity: 'months'
      },
      employee: {
        periodPreset: 'month',
        startDate: '',
        endDate: '',
        granularity: 'weeks'
      }
    },
    showActiveParticipants: true,
    showProjects: false,
    expandedTasks: new Set(),
    selectedTaskId: null,
    showTaskModal: false,
    showOnlyActiveParticipants: true,
    employeeLoadGranularity: 'weeks',
    sidebarCollapsed: false
  },
  init() {
    this.loadCachedData();
    this.ensureParticipantData();
    this.ensureDynamicRawData();
    this.removeImportControls();
    this.ensureSidebarToggle();
    this.applySidebarCollapsedState();
    this.attachGlobalEvents();
    this.renderPage();
  },
  removeImportControls() {
    document.getElementById('importBtn')?.closest('.sidebar__footer')?.remove();
    document.getElementById('excelInput')?.remove();
  },
  ensureSidebarToggle() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar || sidebar.querySelector('.sidebar-toggle')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sidebar-toggle';
    button.setAttribute('aria-label', this.state.sidebarCollapsed ? 'Раскрыть боковую навигацию' : 'Свернуть боковую навигацию');
    button.setAttribute('aria-expanded', String(!this.state.sidebarCollapsed));
    button.innerHTML = `
      <svg class="sidebar-toggle__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d="M9.5 4.5L6 8l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>
    `;
    const brand = sidebar.querySelector('.sidebar__brand');
    if (brand) {
      brand.insertAdjacentElement('afterend', button);
    } else {
      sidebar.prepend(button);
    }
    button.addEventListener('click', () => this.toggleSidebar());
  },
  toggleSidebar() {
    this.state.sidebarCollapsed = !this.state.sidebarCollapsed;
    this.applySidebarCollapsedState();
  },
  applySidebarCollapsedState() {
    const collapsed = Boolean(this.state.sidebarCollapsed);
    const shell = document.querySelector('.app-shell');
    const sidebar = document.querySelector('.sidebar');
    shell?.classList.toggle('app-shell--sidebar-collapsed', collapsed);
    shell?.classList.toggle('is-sidebar-collapsed', collapsed);
    shell?.classList.toggle('sidebar-collapsed', collapsed);
    shell?.classList.toggle('sidebar-expanded', !collapsed);
    sidebar?.classList.toggle('sidebar--collapsed', collapsed);
    sidebar?.classList.toggle('sidebar--expanded', !collapsed);
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    const toggle = sidebar?.querySelector('.sidebar-toggle');
    if (toggle) {
      toggle.setAttribute('aria-expanded', String(!collapsed));
      toggle.setAttribute('aria-label', collapsed ? 'Раскрыть боковую навигацию' : 'Свернуть боковую навигацию');
    }
  },
  attachGlobalEvents() {
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (this.state.showTaskModal) {
          this.closeTaskModal();
        } else {
          this.closeEmployeePreview();
        }
      }
    });
    document.addEventListener('pointerdown', (event) => {
      const preview = this.getFloatingPanelElement('employee-preview');
      if (!preview || document.body.classList.contains('is-dragging-modal')) return;
      if (preview.contains(event.target)) return;
      this.closeEmployeePreview();
    });
    document.getElementById('importBtn')?.addEventListener('click', () => {
      document.getElementById('excelInput')?.click();
    });
    document.getElementById('excelInput')?.addEventListener('change', (event) => this.handleExcelUpload(event));
    document.getElementById('refreshBtn')?.addEventListener('click', () => this.refreshPage());
  },
  loadCachedData() {
    try {
      const cached = window.sessionStorage?.getItem(this.cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        this.mockData = { ...this.mockData, ...parsed };
      }
    } catch (error) {
      console.warn('Не удалось загрузить кэш', error);
    }
  },
  saveCachedData() {
    try {
      window.sessionStorage?.setItem(this.cacheKey, JSON.stringify(this.mockData));
    } catch (error) {
      console.warn('Не удалось сохранить кэш', error);
    }
  },
  ensureDynamicRawData() {
    if (typeof window.ensureDynamicRawData === 'function') {
      window.ensureDynamicRawData(this.mockData);
    }
  },
  ensureParticipantData() {
    if (typeof window.normalizeMockParticipants === 'function') {
      window.normalizeMockParticipants(this.mockData);
    }
  },
  handleExcelUpload(event) {
    const file = event.target.files?.[0];
    if (!file || !window.XLSX) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const workbook = XLSX.read(loadEvent.target.result, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
        if (rows.length) {
          this.mockData.employees = rows.map((row, index) => {
            const centerName = row.centerName || row.center || row['Центр'] || this.mockData.employees?.[0]?.centerName || this.mockData.employees?.[0]?.center || 'Центр “Альфа”';
            const center = this.getCentersList().find((item) => item.id === row.centerId || item.name === centerName || item.shortName === centerName);
            const managementName = row.managementName || row.management || row['Управление'] || this.mockData.employees?.[0]?.managementName || this.mockData.employees?.[0]?.management || 'Управление данных';
            const management = this.getManagementsList().find((item) => item.id === String(row.managementId || '') || item.name === managementName);
            return {
              id: index + 1,
              fullName: row.fullName || row['ФИО'] || `Сотрудник ${index + 1}`,
              shortName: row.shortName || row['Краткое ФИО'] || `С${index + 1}`,
              centerId: row.centerId || center?.id || '',
              centerName: center?.name || centerName,
              center: center?.name || centerName,
              managementId: row.managementId ? String(row.managementId) : management?.id || '',
              managementName: management?.name || managementName,
              management: management?.name || managementName,
              department: row.department || row['Отдел'] || 'Аналитика',
              position: row.position || row['Должность'] || 'Аналитик',
              status: row.status || row['Статус'] || 'В работе',
              plannedHours: Number(row.plannedHours || row['Плановые часы'] || 160),
              actualHours: Number(row.actualHours || row['Фактические часы'] || 140),
              loadPercent: Number(row.loadPercent || row['Загрузка'] || 80),
              tasksTotal: Number(row.tasksTotal || row['Задач всего'] || 10),
              completedTasks: Number(row.completedTasks || row['Выполнено'] || 7),
              tasks: []
            };
          });
          this.saveCachedData();
          this.renderPage();
        }
      } catch (error) {
        console.error('Ошибка импорта Excel', error);
      }
    };
    reader.readAsArrayBuffer(file);
  },
  refreshPage() {
    this.saveCachedData();
    this.renderPage();
  },
  getSidebarItems() {
    return [
      { key: 'techBlock', label: 'Технический блок', href: this.buildPageHref('dashboard', ''), page: 'dashboard' },
      { key: 'centers', label: 'Центры', href: this.buildPageHref('dashboard', ''), page: 'dashboard' },
      { key: 'employees', label: 'Сотрудники', href: this.buildPageHref('employees', ''), page: 'employees' }
    ];
  },
  getCentersList() {
    return Array.isArray(this.mockData.centers) ? this.mockData.centers : [];
  },
  getManagementsList() {
    return Array.isArray(this.mockData.managements) ? this.mockData.managements.map((management) => ({
      id: String(management.id || management.name),
      name: management.name,
      centerId: management.centerId || null
    })) : [];
  },
  getNormalizedEmployees() {
    return (this.mockData.employees || []).map((employee) => {
      const employeeCenterId = employee.centerId ? String(employee.centerId) : '';
      const employeeManagementId = employee.managementId ? String(employee.managementId) : '';
      const center = this.getCentersList().find((item) => item.name === employee.center || item.name === employee.centerName || item.shortName === employee.center || item.id === employeeCenterId);
      const management = this.getManagementsList().find((item) => item.name === employee.management || item.name === employee.managementName || item.id === employeeManagementId);
      return {
        ...employee,
        centerId: employeeCenterId || center?.id || '',
        centerName: employee.centerName || employee.center || center?.name || '',
        managementId: employeeManagementId || management?.id || '',
        managementName: employee.managementName || employee.management || management?.name || ''
      };
    });
  },
  getCenterById(centerId) {
    return this.getCentersList().find((center) => center.id === centerId) || null;
  },
  getCurrentCenterId() {
    if (Object.prototype.hasOwnProperty.call(this.state, 'currentCenter')) {
      return this.state.currentCenter || '';
    }
    const params = new URLSearchParams(window.location.search);
    const centerFromUrl = params.get('center');
    if (centerFromUrl) return centerFromUrl;
    if (this.state.currentCenter) return this.state.currentCenter;
    return '';
  },
  getCurrentCenter() {
    const centerId = this.getCurrentCenterId();
    return centerId ? this.getCenterById(centerId) : null;
  },
  buildPageHref(page, centerId = '') {
    const basePath = page === 'dashboard' ? 'dashboard.html' : page === 'employees' ? 'employees.html' : page === 'employee' ? 'employee.html' : page;
    const query = page === 'dashboard' && centerId ? `?center=${encodeURIComponent(centerId)}` : '';
    return `${basePath}${query}`;
  },
  replaceBrowserUrl(url) {
    if (!window.history?.replaceState || !url) return;
    try {
      window.history.replaceState({}, '', url);
    } catch (error) {
      // file:// pages can reject same-folder HTML path swaps; rendering should still continue.
    }
  },
  navigateToSection(sectionKey) {
    if (sectionKey === 'techBlock') {
      if (document.getElementById('pageContent')) {
        this.setCurrentCenter('techBlock');
        return;
      }
      window.location.assign(this.buildPageHref('dashboard', ''));
      return;
    }
    if (sectionKey === 'employees') {
      if (document.getElementById('pageContent')) {
        this.renderEmployeesPageWithTransition();
        return;
      }
      window.location.assign(this.buildPageHref('employees', ''));
      return;
    }
    if (sectionKey === 'centers') {
      const firstCenter = this.getCentersList()[0];
      if (firstCenter) {
        if (document.getElementById('pageContent')) {
          this.setCurrentCenter(firstCenter.id);
          return;
        }
        window.location.assign(this.buildPageHref('dashboard', firstCenter.id));
      }
      return;
    }
  },
  setCurrentCenter(centerId) {
    this.closeTaskModal({ immediate: true });
    this.closeEmployeePreview({ immediate: true });
    const nextCenterId = !centerId || centerId === 'techBlock' ? '' : centerId;
    const currentCenterId = this.getCurrentCenterId();
    if (nextCenterId === currentCenterId && this.state.currentPage === 'dashboard') {
      this.setActiveCenterTab(nextCenterId || 'techBlock');
      this.updateSidebarActiveState();
      return;
    }
    this.setActiveCenterTab(nextCenterId || 'techBlock');
    this.state.currentPage = 'dashboard';
    document.body.dataset.page = 'dashboard';
    this.state.currentCenter = nextCenterId;
    this.replaceBrowserUrl(this.buildPageHref('dashboard', nextCenterId));
    this.updateSidebarActiveState();
    const title = document.getElementById('pageTitle');
    const nextCenter = nextCenterId ? this.getCenterById(nextCenterId) : null;
    if (title) {
      title.textContent = nextCenter ? nextCenter.name : 'Технический блок';
    }
    const summary = nextCenter ? this.getCenterSummary(nextCenter.id) : this.getTechBlockSummary();
    this.renderAnalyticsPageWithTransition(summary);
  },
  initCenterTabsAnimation(root = document) {
    const tabs = root.querySelector?.('#centerTabs') || document.getElementById('centerTabs');
    if (!tabs) return;
    this.initSwitchIndicator('#centerTabs', '.center-tab', '.center-tabs__indicator', root);
    this.updateCenterTabsIndicator(root, true);
    if (!this.centerTabsResizeBound) {
      this.centerTabsResizeBound = true;
      window.addEventListener('resize', () => this.updateCenterTabsIndicator(document, true));
    }
  },
  moveTabIndicatorWithoutFlight(container, activeButton, options = {}) {
    const indicator = container?.querySelector?.('.tab-indicator, .center-tabs__indicator, .switch-indicator');
    if (!container || !indicator || !activeButton) return;
    window.clearTimeout(indicator._moveTimer);
    const containerRect = container.getBoundingClientRect();
    const buttonRect = activeButton.getBoundingClientRect();
    const lineScale = Number(options.lineScale ?? 0.65);
    const rawWidth = buttonRect.width * lineScale;
    const visibleWidth = container.clientWidth || containerRect.width;
    const availableWidth = Math.max(visibleWidth, container.scrollWidth || 0);
    const indicatorWidth = Math.max(12, Math.min(rawWidth, availableWidth));
    const indicatorLeft = buttonRect.left - containerRect.left + container.scrollLeft + (buttonRect.width - indicatorWidth) / 2;
    const maxLeft = Math.max(0, availableWidth - indicatorWidth);
    const safeLeft = Math.max(0, Math.min(indicatorLeft, maxLeft));
    const nextTop = buttonRect.bottom - containerRect.top - 2 + container.scrollTop;
    const placeIndicator = () => {
      indicator.classList.add('no-motion');
      indicator.style.width = `${indicatorWidth}px`;
      indicator.style.transform = `translate3d(${safeLeft}px, ${nextTop}px, 0)`;
      indicator.offsetHeight;
      indicator.classList.remove('no-motion');
      indicator.classList.remove('is-hidden');
    };
    if (options.instant) {
      placeIndicator();
      return;
    }
    indicator.classList.add('is-hidden');
    indicator._moveTimer = window.setTimeout(placeIndicator, options.delay ?? 140);
  },
  initSwitchIndicator(groupSelector, buttonSelector, indicatorSelector, root = document) {
    const groups = root.querySelectorAll?.(groupSelector) || [];
    groups.forEach((group) => {
      const activeButton = group.querySelector(`${buttonSelector}.is-active`);
      const indicator = group.querySelector(indicatorSelector);
      if (indicator && activeButton) {
        this.moveTabIndicatorWithoutFlight(group, activeButton, { instant: true });
      }
      if (group.dataset.switchIndicatorBound === 'true') return;
      group.dataset.switchIndicatorBound = 'true';
      group.addEventListener('click', (event) => {
        const button = event.target.closest(buttonSelector);
        if (!button || !group.contains(button) || button.disabled) return;
        group.querySelectorAll(buttonSelector).forEach((item) => {
          item.classList.toggle('is-active', item === button);
        });
        if (indicator) {
          this.moveTabIndicatorWithoutFlight(group, button);
        }
      });
    });
  },
  initSwitchIndicators(root = document) {
    this.initSwitchIndicator('#centerTabs', '.center-tab', '.center-tabs__indicator', root);
    this.initSwitchIndicator('.period-switcher', '.period-btn', '.switch-indicator', root);
    this.initSwitchIndicator('.period-preset-switcher', '.period-preset-btn', '.switch-indicator', root);
    this.initSwitchIndicator('.granularity-switcher', '.granularity-btn', '.switch-indicator', root);
  },
  updateCenterTabsIndicator(root = document, instant = false) {
    const tabs = root.querySelector?.('#centerTabs') || document.getElementById('centerTabs');
    const indicator = tabs?.querySelector('.center-tabs__indicator');
    const activeButton = tabs?.querySelector('.center-tab.is-active');
    if (!tabs || !indicator || !activeButton) return;
    this.moveTabIndicatorWithoutFlight(tabs, activeButton, { instant });
  },
  setActiveCenterTab(centerId) {
    const normalizedCenterId = centerId || 'techBlock';
    document.querySelectorAll('.center-tab').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.centerId === normalizedCenterId);
    });
    document.querySelectorAll('.center-tabs').forEach((tabs) => {
      const activeButton = tabs.querySelector('.center-tab.is-active');
      if (activeButton) {
        this.moveTabIndicatorWithoutFlight(tabs, activeButton);
      }
    });
  },
  activateAnalyticsContent() {
    const content = document.querySelector('.analytics-content');
    if (!content) return;
    window.requestAnimationFrame(() => {
      content.classList.remove('is-entering', 'is-leaving');
      content.classList.add('is-visible');
      this.updateCenterTabsIndicator();
    });
  },
  nextFrame() {
    return new Promise((resolve) => {
      let isResolved = false;
      const finish = () => {
        if (isResolved) return;
        isResolved = true;
        resolve();
      };
      window.requestAnimationFrame(() => window.requestAnimationFrame(finish));
      window.setTimeout(finish, 60);
    });
  },
  ensureTransitionRoot() {
    const pageContent = document.getElementById('pageContent');
    if (!pageContent) return null;
    let root = pageContent.querySelector(':scope > .view-transition-root');
    if (root) return root;
    root = document.createElement('div');
    root.className = 'view-transition-root';
    const currentLayer = document.createElement('div');
    currentLayer.className = 'view-layer view-layer--current';
    const nextLayer = document.createElement('div');
    nextLayer.className = 'view-layer view-layer--next';
    while (pageContent.firstChild) {
      currentLayer.appendChild(pageContent.firstChild);
    }
    root.append(currentLayer, nextLayer);
    pageContent.appendChild(root);
    return root;
  },
  getCurrentViewLayer() {
    const root = this.ensureTransitionRoot();
    return root?.querySelector('.view-layer--current') || document.getElementById('pageContent');
  },
  resolveLiveViewLayer(container) {
    // A container captured in a click-handler closure can go stale: once a
    // page transition commits, '.view-layer--next' (where the handler's
    // container pointed) is emptied out and '.view-layer--current' becomes
    // the visible one, but DOM nodes are moved (not recreated), so the old
    // closure still references the now-invisible layer. Redirect back to
    // whatever's actually on screen before rendering into it.
    if (container?.classList?.contains('view-layer--next')) {
      return this.getCurrentViewLayer() || container;
    }
    return container;
  },
  async renderWithTransition(renderFn, options = {}) {
    const root = this.ensureTransitionRoot();
    if (!root) {
      renderFn(document.getElementById('pageContent'), { direct: true });
      return;
    }
    this.viewTransitionToken = (this.viewTransitionToken || 0) + 1;
    const transitionToken = this.viewTransitionToken;
    window.clearTimeout(this.viewTransitionCommitTimer);
    window.clearTimeout(this.viewTransitionLoadingTimer);
    root.classList.remove('is-transitioning', 'is-committing', 'is-loading');
    const currentLayer = root.querySelector('.view-layer--current');
    const nextLayer = root.querySelector('.view-layer--next');
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!currentLayer || !nextLayer || !currentLayer.children.length || prefersReducedMotion) {
      root.classList.remove('is-navigating');
      options.beforeDirectRender?.(currentLayer);
      renderFn(currentLayer || document.getElementById('pageContent'), { direct: true });
      options.afterCommit?.(currentLayer);
      return;
    }
    // Block interaction on the outgoing layer for the whole click-to-commit
    // window (can span 500ms+): otherwise a click landing on soon-to-be-
    // replaced content (e.g. a period-filter button) races the delayed DOM
    // swap below and can leave different controls reflecting different
    // renders once the commit overwrites currentLayer.
    root.classList.add('is-navigating');
    const oldCharts = options.oldCharts || StaffCharts.charts.filter((chart) => currentLayer.contains(chart.canvas));
    const pendingCharts = StaffCharts.charts.filter((chart) => nextLayer.contains(chart.canvas));
    pendingCharts.forEach((chart) => chart.destroy());
    StaffCharts.charts = StaffCharts.charts.filter((chart) => !pendingCharts.includes(chart));
    this.viewTransitionLoadingTimer = window.setTimeout(() => root.classList.add('is-loading'), 150);
    nextLayer.innerHTML = '';
    const rendered = renderFn(nextLayer, { direct: false });
    if (typeof rendered === 'string') {
      nextLayer.innerHTML = rendered;
    }
    await this.nextFrame();
    if (transitionToken !== this.viewTransitionToken) return;
    window.clearTimeout(this.viewTransitionLoadingTimer);
    root.classList.remove('is-loading');
    root.classList.add('is-transitioning');
    this.viewTransitionCommitTimer = window.setTimeout(() => {
      if (transitionToken !== this.viewTransitionToken) return;
      if (options.destroyOldCharts !== false) {
        oldCharts.forEach((chart) => chart.destroy());
        StaffCharts.charts = StaffCharts.charts.filter((chart) => !oldCharts.includes(chart));
      }
      root.classList.add('is-committing');
      currentLayer.innerHTML = '';
      while (nextLayer.firstChild) {
        currentLayer.appendChild(nextLayer.firstChild);
      }
      root.classList.remove('is-transitioning');
      root.classList.remove('is-loading');
      window.requestAnimationFrame(() => {
        root.classList.remove('is-committing');
        root.classList.remove('is-navigating');
        options.afterCommit?.(currentLayer);
      });
    }, options.duration || 480);
  },
  async renderAnalyticsPageWithTransition(summary) {
    return this.renderWithTransition(
      (targetLayer, transitionState) => {
        this.renderAnalyticsPage(summary, targetLayer, { preserveExistingCharts: !transitionState.direct });
      },
      {
        beforeDirectRender: () => StaffCharts.destroyAll(),
        afterCommit: (currentLayer) => this.initCenterTabsAnimation(currentLayer)
      }
    );
  },
  renderTopCenterTabs() {
    const centers = this.getCentersList();
    const currentCenter = this.getCurrentCenter();
    if (!currentCenter) return '';
    return `
      <section class="center-tabs-card">
        <div class="center-tabs-card__head">
          <div>
            <div class="center-tabs-card__eyebrow">Текущий уровень</div>
            <h3>${this.escapeHtml(currentCenter.name)}</h3>
          </div>
          <span class="chip">${centers.length} центров</span>
        </div>
        <div class="center-tabs" id="centerTabs">
          <span class="center-tabs__indicator" aria-hidden="true"></span>
          ${centers.map((center) => `
            <button type="button" class="center-tab ${currentCenter?.id === center.id ? 'is-active' : ''}" data-center-id="${center.id}">
              ${this.escapeHtml(center.shortName || center.name)}
            </button>
          `).join('')}
        </div>
      </section>
    `;
  },
  openCentersDropdown(item = document.querySelector('.sidebar__item--has-dropdown')) {
    window.clearTimeout(this.centersDropdownCloseTimer);
    item?.classList.add('is-open');
  },
  closeCentersDropdown(options = {}) {
    window.clearTimeout(this.centersDropdownCloseTimer);
    const close = () => {
      document.querySelectorAll('.sidebar__item--has-dropdown.is-open').forEach((item) => {
        item.classList.remove('is-open');
      });
    };
    const delay = Number(options.delay || 0);
    if (delay > 0) {
      this.centersDropdownCloseTimer = window.setTimeout(close, delay);
      return;
    }
    close();
  },
  bindCentersDropdown(nav) {
    const item = nav?.querySelector('.sidebar__item--has-dropdown');
    if (!item) return;
    const open = () => this.openCentersDropdown(item);
    const closeLater = () => {
      window.clearTimeout(this.centersDropdownCloseTimer);
      this.centersDropdownCloseTimer = window.setTimeout(() => {
        if (!item.matches(':hover') && !item.contains(document.activeElement)) {
          this.closeCentersDropdown();
        }
      }, 150);
    };

    item.addEventListener('mouseenter', open);
    item.addEventListener('mouseleave', closeLater);
    item.addEventListener('focusin', open);
    item.addEventListener('focusout', closeLater);
  },
  getSidebarItemIconSvg(key) {
    if (key === 'techBlock') {
      return `
        <svg class="sidebar__nav-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <rect x="2" y="2" width="5" height="5" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/>
          <rect x="9" y="2" width="5" height="5" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/>
          <rect x="2" y="9" width="5" height="5" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/>
          <rect x="9" y="9" width="5" height="5" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/>
        </svg>
      `;
    }
    if (key === 'centers') {
      return `
        <svg class="sidebar__nav-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <circle cx="4" cy="4" r="2" fill="none" stroke="currentColor" stroke-width="1.4"/>
          <circle cx="12" cy="4" r="2" fill="none" stroke="currentColor" stroke-width="1.4"/>
          <circle cx="8" cy="12" r="2" fill="none" stroke="currentColor" stroke-width="1.4"/>
          <path d="M5.6 5.4L6.8 10.2M10.4 5.4L9.2 10.2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        </svg>
      `;
    }
    return `
      <svg class="sidebar__nav-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <circle cx="8" cy="5" r="2.6" fill="none" stroke="currentColor" stroke-width="1.4"/>
        <path d="M3 14c0-2.8 2.2-5 5-5s5 2.2 5 5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
      </svg>
    `;
  },
  renderSidebar() {
    const nav = document.getElementById('sidebar-nav');
    if (!nav) return;
    const items = this.getSidebarItems();
    const currentPage = this.state.currentPage === 'employee' ? 'employees' : this.state.currentPage;
    const centers = this.getCentersList();
    const currentCenterId = this.getCurrentCenterId();
    const activeKey = currentPage === 'employees' ? 'employees' : (currentCenterId ? 'centers' : 'techBlock');
    nav.innerHTML = `
      ${items.map((item) => {
        const isActive = item.key === activeKey;
        const compactLabel = item.key === 'techBlock' ? 'ТБ' : item.key === 'centers' ? 'Ц' : 'С';
        const itemClasses = [
          'sidebar__item',
          item.key === 'techBlock' ? 'sidebar__item--parent' : '',
          item.key === 'centers' ? 'sidebar__item--has-dropdown' : '',
          isActive ? 'is-active' : ''
        ].filter(Boolean).join(' ');
        if (item.key === 'centers') {
          return `
            <div class="${itemClasses}">
              <a class="sidebar__item-link" href="${item.href}" data-nav-item="${item.key}">
                <span class="sidebar__dot sidebar__icon" aria-hidden="true">${this.getSidebarItemIconSvg(item.key)}</span>
                <span class="sidebar__compact-label" aria-hidden="true">${compactLabel}</span>
                <span class="sidebar__content">
                  <span class="sidebar__label">${this.escapeHtml(item.label)}</span>
                </span>
                <svg class="sidebar__chevron" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                  <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </a>
              <div class="sidebar__dropdown">
                ${centers.map((center) => `
                  <a class="sidebar__dropdown-item ${currentCenterId === center.id ? 'is-active' : ''}" href="${this.buildPageHref('dashboard', center.id)}" data-sidebar-center-id="${this.escapeHtml(center.id)}">
                    <span>${this.escapeHtml(center.name)}</span>
                    <span class="sidebar__dropdown-item__hint">${this.escapeHtml(center.shortName || center.name)}</span>
                  </a>
                `).join('')}
              </div>
            </div>
          `;
        }
        return `
          <div class="${itemClasses}">
            <a class="sidebar__item-link" href="${item.href}" data-nav-item="${item.key}">
              <span class="sidebar__dot sidebar__icon" aria-hidden="true">${this.getSidebarItemIconSvg(item.key)}</span>
              <span class="sidebar__compact-label" aria-hidden="true">${compactLabel}</span>
              <span class="sidebar__content">
                <span class="sidebar__label">${this.escapeHtml(item.label)}</span>
              </span>
            </a>
          </div>
        `;
      }).join('')}
    `;

    nav.querySelectorAll('[data-nav-item]').forEach((link) => {
      link.addEventListener('click', (event) => {
        const key = link.getAttribute('data-nav-item');
        if (key === 'centers') {
          event.preventDefault();
          this.closeCentersDropdown();
          this.navigateToSection(key);
          return;
        }
        if (key === 'techBlock' || key === 'employees') {
          event.preventDefault();
          this.closeCentersDropdown();
          this.navigateToSection(key);
        }
      });
    });
    nav.querySelectorAll('[data-sidebar-center-id]').forEach((link) => {
      link.addEventListener('click', (event) => {
        this.closeCentersDropdown();
        if (!document.getElementById('pageContent')) return;
        event.preventDefault();
        this.setCurrentCenter(link.getAttribute('data-sidebar-center-id'));
      });
    });
    this.bindCentersDropdown(nav);
  },
  updateSidebarActiveState() {
    const nav = document.getElementById('sidebar-nav');
    if (!nav || !nav.children.length) {
      this.renderSidebar();
      return;
    }
    const currentPage = this.state.currentPage === 'employee' ? 'employees' : this.state.currentPage;
    const activeKey = currentPage === 'employees' ? 'employees' : (this.getCurrentCenterId() ? 'centers' : 'techBlock');
    nav.querySelectorAll('.sidebar__item').forEach((item) => {
      const navTarget = item.matches('[data-nav-item]') ? item : item.querySelector('[data-nav-item]');
      item.classList.toggle('is-active', navTarget?.getAttribute('data-nav-item') === activeKey);
    });
    nav.querySelectorAll('[data-sidebar-center-id]').forEach((link) => {
      link.classList.toggle('is-active', link.getAttribute('data-sidebar-center-id') === this.getCurrentCenterId());
    });
  },
  renderPage() {
    StaffCharts.destroyAll();
    const container = document.getElementById('pageContent');
    const title = document.getElementById('pageTitle');
    if (!container || !title) return;
    this.closeTaskModal({ immediate: true });
    this.closeEmployeePreview({ immediate: true });
    const page = document.body.dataset.page || 'dashboard';
    this.state.currentPage = page;
    this.state.currentCenter = this.getCurrentCenterId();
    this.renderSidebar();
    if (page === 'employee') {
      title.textContent = 'Сотрудник';
      this.renderEmployeePage(container);
    } else if (page === 'employees') {
      title.textContent = 'Сотрудники';
      this.renderEmployeesPage(container);
    } else {
      const currentCenter = this.getCurrentCenter();
      title.textContent = currentCenter ? currentCenter.name : 'Технический блок';
      this.renderDashboardPage(container);
    }
  },
  isAdminEmployee(employee) {
    return /админ|admin/i.test(`${employee.department || ''} ${employee.position || ''}`);
  },
  getPeriodCards() {
    return (this.mockData.periodCards || []).slice(0, 5);
  },
  getQuarterlyLoad() {
    return (this.mockData.quarterlyLoad || []).map((item) => ({
      label: item.label || `${item.quarter} квартал`,
      percent: Number(item.percent ?? item.value ?? 0)
    }));
  },
  getPercentChange(currentValue, previousValue) {
    const current = Number(currentValue);
    const previous = Number(previousValue);
    if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) {
      return null;
    }
    return ((current - previous) / previous) * 100;
  },
  formatDeltaPercent(value) {
    if (value === null || value === undefined || value === '') {
      return '—';
    }
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return '—';
    }
    const roundedValue = Math.round(numericValue * 10) / 10;
    if (Math.abs(roundedValue) < 0.1) {
      return '0.0%';
    }
    return `${roundedValue > 0 ? '+' : ''}${roundedValue.toFixed(1)}%`;
  },
  getDeltaClass(value, isNegativeMetric = false) {
    const numericValue = Number(value);
    if (value === null || value === undefined || !Number.isFinite(numericValue) || Math.abs(numericValue) < 0.1) {
      return 'metric-delta--neutral';
    }
    const isPositiveDelta = numericValue > 0;
    const isGoodDelta = isNegativeMetric ? !isPositiveDelta : isPositiveDelta;
    return isGoodDelta ? 'metric-delta--positive' : 'metric-delta--negative';
  },
  getComparisonCaption(periodPreset) {
    if (periodPreset === 'week') {
      return 'по сравнению с прошлой неделей';
    }
    if (periodPreset === 'month') {
      return 'по сравнению с прошлым месяцем';
    }
    if (periodPreset === 'quarter') {
      return 'по сравнению с прошлым кварталом';
    }
    if (periodPreset === 'year') {
      return 'по сравнению с прошлым годом';
    }
    return 'по сравнению с прошлым периодом';
  },
  renderTrendArrow(isUp) {
    const upPath = '<polyline points="0.7 8 6 2.7 9.3 6 15.3 0.7" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><polyline points="11.3 0.7 15.3 0.7 15.3 4.7" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>';
    const downPath = '<polyline points="0.7 4.7 6 10 9.3 6.7 15.3 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><polyline points="11.3 12 15.3 12 15.3 8" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>';
    return `<span class="metric-delta__trend" aria-hidden="true"><svg viewBox="0 0 16 13" focusable="false">${isUp ? upPath : downPath}</svg></span>`;
  },
  renderMetricDelta(currentValue, previousValue, isNegativeMetric = false, compareCaption = 'по сравнению с прошлым периодом', inlineCompare = false) {
    const delta = this.getPercentChange(currentValue, previousValue);
    const deltaClass = this.getDeltaClass(delta, isNegativeMetric);
    const trendIcon = (delta === null || Math.abs(delta) < 0.1) ? '' : this.renderTrendArrow(delta > 0);
    const deltaMarkup = `<div class="metric-delta ${deltaClass}">${trendIcon}${this.escapeHtml(this.formatDeltaPercent(delta))}</div>`;
    if (delta === null) {
      return deltaMarkup;
    }
    return `
      <div class="metric-delta-wrap${inlineCompare ? ' metric-delta-wrap--inline' : ''}">
        ${deltaMarkup}
        <div class="metric-delta__compare" title="${this.escapeHtml(compareCaption)}">${this.escapeHtml(compareCaption)}</div>
      </div>
    `;
  },
  getPeriodTemporalGroup(index) {
    if (index === 3) {
      return {
        key: 'past',
        label: 'Прошлое',
        icon: '<polyline points="0.7 2.7 0.7 6.7 4.7 6.7" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M2.3 10a6 6 0 1 0 1.4-6.2L0.7 6.7" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>'
      };
    }
    if (index === 4) {
      return {
        key: 'future',
        label: 'Будущее',
        icon: '<path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>'
      };
    }
    return {
      key: 'present',
      label: 'Настоящее',
      icon: '<circle cx="8" cy="8" r="5.3" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="8" r="1.8" fill="currentColor" stroke="none"/>'
    };
  },
  renderPeriodCardGroupBadge(index) {
    const group = this.getPeriodTemporalGroup(index);
    return `
      <div class="period-card__group">
        <span class="period-card__group-icon" aria-hidden="true"><svg viewBox="0 0 16 16" focusable="false">${group.icon}</svg></span>
        <span class="period-card__group-label">${this.escapeHtml(group.label)}</span>
      </div>
    `;
  },
  getLoadLevelClass(percent) {
    const numericValue = Number(percent);
    if (!Number.isFinite(numericValue)) {
      return '';
    }
    if (numericValue <= 40) {
      return 'load-level--low';
    }
    if (numericValue <= 75) {
      return 'load-level--medium';
    }
    return 'load-level--high';
  },
  normalizeGranularity(granularity) {
    return this.getDynamicGranularityKeys(granularity).plural;
  },
  getDynamicSubtitle(granularity) {
    const value = this.normalizeGranularity(granularity);
    if (value === 'days') {
      return 'Средняя загрузка по дням';
    }
    if (value === 'months') {
      return 'Средняя загрузка по месяцам';
    }
    if (value === 'quarters') {
      return 'Средняя загрузка по кварталам';
    }
    return 'Средняя загрузка по неделям';
  },
  getDynamicGranularityKeys(granularity) {
    const value = String(granularity || 'week').toLowerCase();
    if (value === 'day' || value === 'days') {
      return { singular: 'day', plural: 'days' };
    }
    if (value === 'month' || value === 'months') {
      return { singular: 'month', plural: 'months' };
    }
    if (value === 'quarter' || value === 'quarters') {
      return { singular: 'quarter', plural: 'quarters' };
    }
    return { singular: 'week', plural: 'weeks' };
  },
  getAllowedGranularities(periodPreset) {
    const preset = String(periodPreset || 'month');
    if (preset === 'month') {
      return ['weeks', 'days'];
    }
    if (preset === 'quarter') {
      return ['weeks', 'months'];
    }
    if (preset === 'year') {
      return ['weeks', 'months', 'quarters'];
    }
    return ['weeks', 'months', 'quarters'];
  },
  getDynamicSeries(sourceData, granularity) {
    if (!sourceData) {
      return [];
    }
    const keys = this.getDynamicGranularityKeys(granularity);
    const candidates = [
      sourceData.history?.[keys.plural],
      sourceData.history?.[keys.singular],
      sourceData.dynamicLoad?.[keys.plural],
      sourceData[keys.plural],
      sourceData[keys.singular]
    ];
    const series = candidates.find((items) => Array.isArray(items) || Number.isFinite(Number(items)));
    if (Array.isArray(series)) {
      return series;
    }
    return Number.isFinite(Number(series)) ? [Number(series)] : [];
  },
  getDefaultDynamicLabels(granularity, length) {
    const keys = this.getDynamicGranularityKeys(granularity);
    if (keys.plural === 'days') {
      return Array.from({ length }, (_, index) => `${index + 1}`);
    }
    if (keys.plural === 'quarters') {
      const quarters = ['I квартал', 'II квартал', 'III квартал', 'IV квартал'];
      return Array.from({ length }, (_, index) => quarters[index] || `${index + 1} квартал`);
    }
    if (keys.plural === 'months') {
      const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
      return Array.from({ length }, (_, index) => months[index] || `Месяц ${index + 1}`);
    }
    return Array.from({ length }, (_, index) => `Неделя ${index + 1}`);
  },
  getDynamicLabels(sourceData, granularity) {
    const series = this.getDynamicSeries(sourceData, granularity);
    const fallbackLabels = this.getDefaultDynamicLabels(granularity, series.length);
    return series.map((entry, index) => {
      if (entry && typeof entry === 'object' && entry.label) {
        return String(entry.label);
      }
      return fallbackLabels[index] || String(index + 1);
    });
  },
  getDynamicValues(sourceData, granularity) {
    return this.getDynamicSeries(sourceData, granularity)
      .map((entry) => {
        if (entry && typeof entry === 'object') {
          return Number(entry.value ?? entry.percent ?? entry.loadPercent);
        }
        return Number(entry);
      })
      .filter(Number.isFinite);
  },
  getDateInputValue(date) {
    const normalizedDate = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(normalizedDate.getTime())) {
      return '';
    }
    const pad = (value) => String(value).padStart(2, '0');
    return `${normalizedDate.getFullYear()}-${pad(normalizedDate.getMonth() + 1)}-${pad(normalizedDate.getDate())}`;
  },
  parseInputDate(value) {
    if (!value) {
      return null;
    }
    const [year, month, day] = String(value).split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  },
  getPeriodRange(periodPreset = 'month', unitIndex = null) {
    const today = new Date();
    const preset = String(periodPreset || 'month');
    const year = today.getFullYear();
    let startDate;
    let endDate;

    if (preset === 'week') {
      const day = today.getDay() || 7;
      startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - day + 1);
      endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + (7 - day));
    } else if (preset === 'quarter') {
      const quarterIndex = Number.isInteger(unitIndex) ? unitIndex : Math.floor(today.getMonth() / 3);
      const quarterStartMonth = quarterIndex * 3;
      startDate = new Date(year, quarterStartMonth, 1);
      endDate = new Date(year, quarterStartMonth + 3, 0);
    } else if (preset === 'year') {
      startDate = new Date(year, 0, 1);
      endDate = new Date(year, 11, 31);
    } else {
      const monthIndex = Number.isInteger(unitIndex) ? unitIndex : today.getMonth();
      startDate = new Date(year, monthIndex, 1);
      endDate = new Date(year, monthIndex + 1, 0);
    }

    return {
      startDate: this.getDateInputValue(startDate),
      endDate: this.getDateInputValue(endDate)
    };
  },
  getDefaultPeriodUnit(periodPreset) {
    const preset = String(periodPreset);
    const today = new Date();
    if (preset === 'quarter') {
      return Math.floor(today.getMonth() / 3);
    }
    if (preset === 'year') {
      return 0;
    }
    return today.getMonth();
  },
  getPeriodUnitOptionsMarkup(periodPreset, selectedUnit) {
    const year = new Date().getFullYear();
    if (periodPreset === 'month') {
      const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
      return months.map((name, index) => `<option value="${index}" ${selectedUnit === index ? 'selected' : ''}>${this.escapeHtml(name)} ${year}</option>`).join('');
    }
    if (periodPreset === 'quarter') {
      const quarters = ['I квартал', 'II квартал', 'III квартал', 'IV квартал'];
      return quarters.map((name, index) => `<option value="${index}" ${selectedUnit === index ? 'selected' : ''}>${this.escapeHtml(name)} ${year}</option>`).join('');
    }
    if (periodPreset === 'year') {
      return `<option value="0" selected>${year}</option>`;
    }
    return '';
  },
  getAveragePeriodLabel(settings) {
    const year = new Date().getFullYear();
    const preset = settings?.periodPreset;
    if (preset === 'month') {
      const months = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
      const index = Number.isInteger(settings.periodUnit) ? settings.periodUnit : new Date().getMonth();
      return `среднее за ${months[index] || ''} ${year}`;
    }
    if (preset === 'quarter') {
      const quarters = ['I квартал', 'II квартал', 'III квартал', 'IV квартал'];
      const index = Number.isInteger(settings.periodUnit) ? settings.periodUnit : 0;
      return `среднее за ${quarters[index] || ''} ${year}`;
    }
    if (preset === 'year') {
      return `среднее за ${year} год`;
    }
    return 'среднее за выбранный период';
  },
  getDynamicSettings(level = 'techBlock') {
    const defaultSettings = {
      techBlock: { periodPreset: 'year', granularity: 'months' },
      center: { periodPreset: 'year', granularity: 'months' },
      employee: { periodPreset: 'month', granularity: 'weeks' }
    };
    const normalizedLevel = ['techBlock', 'center', 'employee'].includes(level) ? level : 'techBlock';
    this.state.dynamics = this.state.dynamics || {};
    const currentSettings = this.state.dynamics[normalizedLevel] || {};
    const preset = currentSettings.periodPreset || defaultSettings[normalizedLevel].periodPreset;
    const periodUnit = Number.isInteger(currentSettings.periodUnit) ? currentSettings.periodUnit : this.getDefaultPeriodUnit(preset);
    const range = preset === 'custom'
      ? this.getPeriodRange(defaultSettings[normalizedLevel].periodPreset)
      : this.getPeriodRange(preset, periodUnit);
    const allowedGranularities = this.getAllowedGranularities(preset);
    let granularity = this.normalizeGranularity(currentSettings.granularity || defaultSettings[normalizedLevel].granularity);
    if (!allowedGranularities.includes(granularity)) {
      granularity = allowedGranularities[0];
    }
    const settings = {
      periodPreset: preset,
      periodUnit,
      startDate: currentSettings.startDate || range.startDate,
      endDate: currentSettings.endDate || range.endDate,
      granularity
    };
    this.state.dynamics[normalizedLevel] = settings;
    return settings;
  },
  setDynamicPeriod(level, periodPreset) {
    const settings = this.getDynamicSettings(level);
    const preset = String(periodPreset || settings.periodPreset);
    settings.periodPreset = preset;
    if (preset !== 'custom') {
      const unit = this.getDefaultPeriodUnit(preset);
      settings.periodUnit = unit;
      const range = this.getPeriodRange(preset, unit);
      settings.startDate = range.startDate;
      settings.endDate = range.endDate;
    }
    const allowedGranularities = this.getAllowedGranularities(preset);
    if (!allowedGranularities.includes(settings.granularity)) {
      settings.granularity = allowedGranularities[0];
    }
    this.state.dynamics[level] = settings;
    return settings;
  },
  setDynamicPeriodUnit(level, unitIndex) {
    const settings = this.getDynamicSettings(level);
    const index = Number(unitIndex);
    if (!Number.isFinite(index)) {
      return settings;
    }
    settings.periodUnit = index;
    const range = this.getPeriodRange(settings.periodPreset, index);
    settings.startDate = range.startDate;
    settings.endDate = range.endDate;
    this.state.dynamics[level] = settings;
    return settings;
  },
  setCustomDynamicPeriod(level, startDate, endDate) {
    const settings = this.getDynamicSettings(level);
    settings.periodPreset = 'custom';
    settings.startDate = startDate || settings.startDate;
    settings.endDate = endDate || settings.endDate;
    this.state.dynamics[level] = settings;
    return settings;
  },
  setDynamicGranularity(level, granularity) {
    const settings = this.getDynamicSettings(level);
    const normalized = this.normalizeGranularity(granularity);
    const allowedGranularities = this.getAllowedGranularities(settings.periodPreset);
    settings.granularity = allowedGranularities.includes(normalized) ? normalized : allowedGranularities[0];
    this.state.dynamics[level] = settings;
    if (level === 'techBlock' || level === 'center') {
      this.state.dynamicGranularity = settings.granularity;
    }
    if (level === 'employee') {
      this.state.employeeLoadGranularity = settings.granularity;
    }
    return settings;
  },
  getOverviewPeriodSettings(level) {
    const normalizedLevel = ['techBlock', 'center', 'employees', 'employeePreview'].includes(level) ? level : 'techBlock';
    this.state.overviewPeriod = this.state.overviewPeriod || {};
    const current = this.state.overviewPeriod[normalizedLevel] || {};
    const preset = current.periodPreset || 'month';
    const periodUnit = Number.isInteger(current.periodUnit) ? current.periodUnit : this.getDefaultPeriodUnit(preset);
    const range = preset === 'custom' ? this.getPeriodRange('month') : this.getPeriodRange(preset, periodUnit);
    const settings = {
      periodPreset: preset,
      periodUnit,
      startDate: current.startDate || range.startDate,
      endDate: current.endDate || range.endDate
    };
    this.state.overviewPeriod[normalizedLevel] = settings;
    return settings;
  },
  setOverviewPeriod(level, periodPreset) {
    const settings = this.getOverviewPeriodSettings(level);
    const preset = String(periodPreset || settings.periodPreset);
    settings.periodPreset = preset;
    if (preset !== 'custom') {
      const unit = this.getDefaultPeriodUnit(preset);
      settings.periodUnit = unit;
      const range = this.getPeriodRange(preset, unit);
      settings.startDate = range.startDate;
      settings.endDate = range.endDate;
    }
    this.state.overviewPeriod[level] = settings;
    return settings;
  },
  setOverviewPeriodUnit(level, unitIndex) {
    const settings = this.getOverviewPeriodSettings(level);
    const index = Number(unitIndex);
    if (!Number.isFinite(index)) {
      return settings;
    }
    settings.periodUnit = index;
    const range = this.getPeriodRange(settings.periodPreset, index);
    settings.startDate = range.startDate;
    settings.endDate = range.endDate;
    this.state.overviewPeriod[level] = settings;
    return settings;
  },
  setCustomOverviewPeriod(level, startDate, endDate) {
    const settings = this.getOverviewPeriodSettings(level);
    settings.periodPreset = 'custom';
    settings.startDate = startDate || settings.startDate;
    settings.endDate = endDate || settings.endDate;
    this.state.overviewPeriod[level] = settings;
    return settings;
  },
  renderOverviewPeriodBar(level) {
    const settings = this.getOverviewPeriodSettings(level);
    const presetOptions = [
      { key: 'month', label: 'Месяц' },
      { key: 'quarter', label: 'Квартал' },
      { key: 'year', label: 'Год' },
      { key: 'custom', label: 'Свой период' }
    ];
    const isCustom = settings.periodPreset === 'custom';
    const unitOptionsMarkup = this.getPeriodUnitOptionsMarkup(settings.periodPreset, settings.periodUnit);
    const unitSelector = unitOptionsMarkup ? `
      <select class="period-unit-select" data-overview-level="${this.escapeHtml(level)}" data-overview-period-unit-select>
        ${unitOptionsMarkup}
      </select>
    ` : '';
    const customDateFields = `
      <div class="custom-period-fields custom-period-fields--inline">
        <label>
          <span>Дата начала</span>
          <input class="date-fit" type="date" value="${this.escapeHtml(settings.startDate)}" data-overview-level="${this.escapeHtml(level)}" data-overview-period-start>
        </label>
        <label>
          <span>Дата окончания</span>
          <input class="date-fit" type="date" value="${this.escapeHtml(settings.endDate)}" data-overview-level="${this.escapeHtml(level)}" data-overview-period-end>
        </label>
      </div>
    `;
    const rightGroup = isCustom
      ? `
        <span class="dynamic-controls__divider" aria-hidden="true"></span>
        <div class="dynamic-controls__group dynamic-controls__group--custom-dates">
          ${customDateFields}
        </div>
      `
      : (unitSelector ? `
        <span class="dynamic-controls__divider" aria-hidden="true"></span>
        <div class="dynamic-controls__group dynamic-controls__group--unit">
          <span class="dynamic-controls__label">${settings.periodPreset === 'month' ? 'Месяц' : settings.periodPreset === 'quarter' ? 'Квартал' : 'Год'}</span>
          ${unitSelector}
        </div>
      ` : '');
    return `
      <div class="overview-period-bar" data-overview-level="${this.escapeHtml(level)}">
        <div class="dynamic-controls__panel">
          <div class="dynamic-controls__group dynamic-controls__group--period">
            <span class="dynamic-controls__label">Период страницы</span>
            <div class="period-preset-switcher" data-overview-level="${this.escapeHtml(level)}">
              ${presetOptions.map((option) => `
                <button type="button" class="period-preset-btn ${settings.periodPreset === option.key ? 'is-active' : ''}" data-overview-level="${this.escapeHtml(level)}" data-overview-period-preset="${option.key}">
                  ${this.escapeHtml(option.label)}
                </button>
              `).join('')}
            </div>
          </div>
          ${rightGroup}
        </div>
      </div>
    `;
  },
  attachOverviewPeriodListeners(level, container, onChange) {
    container.querySelectorAll(`[data-overview-period-preset][data-overview-level="${level}"]`).forEach((button) => {
      button.addEventListener('click', () => {
        this.setOverviewPeriod(level, button.dataset.overviewPeriodPreset);
        onChange();
      });
    });
    container.querySelectorAll(`[data-overview-period-unit-select][data-overview-level="${level}"]`).forEach((select) => {
      select.addEventListener('change', () => {
        this.setOverviewPeriodUnit(level, select.value);
        onChange();
      });
    });
    container.querySelectorAll(`.overview-period-bar[data-overview-level="${level}"] input[type="date"]`).forEach((input) => {
      input.addEventListener('change', () => {
        const fields = input.closest('.custom-period-fields');
        const startInput = fields?.querySelector('[data-overview-period-start]');
        const endInput = fields?.querySelector('[data-overview-period-end]');
        this.setCustomOverviewPeriod(level, startInput?.value || '', endInput?.value || '');
        onChange();
      });
    });
  },
  isDateWithinRange(dateValue, startDate, endDate) {
    if (!dateValue) {
      return false;
    }
    const value = String(dateValue);
    if (startDate && value < startDate) {
      return false;
    }
    if (endDate && value > endDate) {
      return false;
    }
    return true;
  },
  getPeriodDaysCount(periodRange) {
    const start = this.parseInputDate(periodRange?.startDate);
    const end = this.parseInputDate(periodRange?.endDate);
    if (!start || !end) {
      return 30;
    }
    return Math.max(1, Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1);
  },
  getProratedHours(baseHours, periodRange) {
    if (baseHours === null || baseHours === undefined || !periodRange) {
      return baseHours;
    }
    const BASELINE_DAYS = 30;
    const days = this.getPeriodDaysCount(periodRange);
    return Math.round(baseHours * (days / BASELINE_DAYS));
  },
  getAverageLoadForRange(sourceData, startDate, endDate) {
    const rawSeries = this.getDynamicRawSeries(sourceData);
    const rangeStart = this.parseInputDate(startDate);
    const rangeEnd = this.parseInputDate(endDate);
    if (!rawSeries.length || !rangeStart || !rangeEnd) {
      return null;
    }
    const startTime = rangeStart.getTime();
    const endTime = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate(), 23, 59, 59).getTime();
    const values = rawSeries
      .map((entry) => ({ time: this.parseInputDate(entry.date)?.getTime(), value: Number(entry.value) }))
      .filter((entry) => Number.isFinite(entry.time) && Number.isFinite(entry.value) && entry.time >= startTime && entry.time <= endTime)
      .map((entry) => entry.value);
    return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
  },
  formatDateForDisplay(value) {
    const date = this.parseInputDate(value);
    if (!date) {
      return '—';
    }
    const pad = (item) => String(item).padStart(2, '0');
    return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
  },
  formatDynamicSubtitle(settings) {
    const granularityLabels = {
      days: 'по дням',
      weeks: 'по неделям',
      months: 'по месяцам',
      quarters: 'по кварталам'
    };
    const currentSettings = settings || this.getDynamicSettings('techBlock');
    return `Период: ${this.formatDateForDisplay(currentSettings.startDate)} — ${this.formatDateForDisplay(currentSettings.endDate)} · детализация ${granularityLabels[currentSettings.granularity] || 'по неделям'}`;
  },
  getChartPaletteSequence() {
    const colors = REFERENCE_CHART_THEME.colors;
    return [colors.ember, colors.brass, colors.graphite, colors.slate, colors.mist];
  },
  getCompactLegendItems(items = [], maxItems = 5) {
    const palette = this.getChartPaletteSequence();
    const entries = items.map((item, index) => ({
      label: item.label || item.name || item.title || 'Без категории',
      value: Number(item.value ?? item.percent ?? item.count ?? 0) || 0,
      color: item.color || palette[index % palette.length]
    })).filter((item) => item.value > 0);

    if (entries.length <= maxItems) {
      return entries;
    }

    const sorted = [...entries].sort((a, b) => b.value - a.value);
    const visible = sorted.slice(0, maxItems - 1);
    const otherValue = sorted.slice(maxItems - 1).reduce((sum, item) => sum + item.value, 0);
    return [...visible, { label: 'Прочее', value: otherValue, color: REFERENCE_CHART_THEME.colors.mist }];
  },
  renderChartLegend(items = [], options = {}) {
    const suffix = options.suffix ?? '%';
    const maxItems = options.maxItems || 5;
    const hideValues = Boolean(options.hideValues);
    const legendItems = this.getCompactLegendItems(items, maxItems);
    if (!legendItems.length) {
      return `
        <div class="chart-legend chart-legend--vertical">
          <div class="chart-legend__item">
            <span class="chart-legend__marker" style="background:${REFERENCE_CHART_THEME.colors.mist}"></span>
            <span class="chart-legend__label">Нет данных</span>
            <span class="chart-legend__value">—</span>
          </div>
        </div>
      `;
    }
    return `
      <div class="chart-legend chart-legend--vertical">
        ${legendItems.map((item) => `
          <div class="chart-legend__item">
            <span class="chart-legend__marker" style="background:${this.escapeHtml(item.color)}"></span>
            <span class="chart-legend__label">${this.escapeHtml(item.label)}</span>
            ${hideValues ? '' : `<span class="chart-legend__value ${this.isPercentText(suffix) ? 'percent-value percent-value--inline' : ''}">${this.escapeHtml(`${Math.round(item.value)}${suffix}`)}</span>`}
          </div>
        `).join('')}
      </div>
    `;
  },
  renderDonutCenter(value, caption, className = '') {
    const valueClass = this.isPercentText(value) ? ' percent-value' : '';
    return `
      <div class="donut-center-label ${this.escapeHtml(className)}">
        <span class="donut-center-label__value viz-metric-value${valueClass}">${this.escapeHtml(value)}</span>
        <span class="donut-center-label__caption">${this.escapeHtml(caption)}</span>
      </div>
    `;
  },
  getDynamicAverageValue(sourceData, settings) {
    const chartData = this.getDynamicChartData(sourceData, settings.startDate, settings.endDate, settings.granularity);
    const values = chartData.values.length ? chartData.values : this.getDynamicValues(sourceData, settings.granularity);
    if (!values.length) {
      return null;
    }
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  },
  renderDataVizMetric(value, label, id = '') {
    const valueText = value === null || value === undefined || value === '' ? '—' : value;
    const valueClass = this.isPercentText(valueText) ? ' percent-value' : '';
    return `
      <div class="data-viz-card__metric metric-card--fit">
        <span class="data-viz-card__metric-value viz-metric-value value-fit metric-value-large${valueClass}" ${id ? `id="${this.escapeHtml(id)}"` : ''}>${this.escapeHtml(valueText)}</span>
        <span class="data-viz-card__metric-label">${this.escapeHtml(label)}</span>
      </div>
    `;
  },
  isPercentText(value) {
    return String(value ?? '').includes('%');
  },
  renderPercentBadge(value, className = '') {
    return `<span class="badge ${this.escapeHtml(className)}"><span class="percent-value percent-value--badge">${this.escapeHtml(value)}</span></span>`;
  },
  renderBarChartFooter() {
    return `
      <div class="bar-chart-footer">
        ${this.renderChartLegend([
          { label: 'План', value: 1, color: REFERENCE_CHART_THEME.colors.mist },
          { label: 'Факт', value: 1, color: REFERENCE_CHART_THEME.colors.brass },
          { label: 'Итого', value: 1, color: REFERENCE_CHART_THEME.colors.ember }
        ], { suffix: '', maxItems: 3, hideValues: true })}
        <div class="bar-chart-total-note">Последняя группа показывает сумму за выбранный период.</div>
      </div>
    `;
  },
  formatEmployeePlanFactSubtitle() {
    const granularityLabels = {
      week: 'по дням',
      month: 'по неделям',
      quarter: 'по месяцам',
      year: 'по кварталам'
    };
    const granularityLabel = granularityLabels[this.state.employeePeriod] || 'по этапам';
    return `Период: ${this.formatDateForDisplay(this.state.employeeStartDate)} — ${this.formatDateForDisplay(this.state.employeeEndDate)} · детализация ${granularityLabel}`;
  },
  getDynamicRawSeries(sourceData) {
    if (!sourceData) {
      return [];
    }
    const candidates = [
      sourceData.dynamicLoad?.raw,
      sourceData.history?.raw,
      sourceData.raw
    ];
    return candidates.find((items) => Array.isArray(items)) || [];
  },
  getMonthLabel(monthIndex) {
    return ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'][monthIndex] || `Месяц ${monthIndex + 1}`;
  },
  getQuarterLabel(quarterIndex) {
    return ['I квартал', 'II квартал', 'III квартал', 'IV квартал'][quarterIndex] || `${quarterIndex + 1} квартал`;
  },
  getDynamicChartData(sourceData, startDate, endDate, granularity) {
    const currentGranularity = this.normalizeGranularity(granularity);
    const rangeStart = this.parseInputDate(startDate);
    const rangeEnd = this.parseInputDate(endDate);
    const rawSeries = this.getDynamicRawSeries(sourceData);

    if (!rawSeries.length || !rangeStart || !rangeEnd) {
      const values = this.getDynamicValues(sourceData, currentGranularity);
      const labels = this.getDynamicLabels(sourceData, currentGranularity);
      return {
        labels: labels.slice(0, values.length),
        values
      };
    }

    const startTime = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate()).getTime();
    const endTime = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate(), 23, 59, 59).getTime();
    const groups = new Map();
    const dayMs = 24 * 60 * 60 * 1000;

    rawSeries.forEach((entry) => {
      const entryDate = this.parseInputDate(entry.date);
      const value = Number(entry.value ?? entry.percent ?? entry.loadPercent);
      if (!entryDate || !Number.isFinite(value)) {
        return;
      }
      const entryTime = entryDate.getTime();
      if (entryTime < startTime || entryTime > endTime) {
        return;
      }

      let key;
      let label;
      let order;

      if (currentGranularity === 'days') {
        key = entry.date;
        label = String(entryDate.getDate());
        order = entryTime;
      } else if (currentGranularity === 'months') {
        key = `${entryDate.getFullYear()}-${entryDate.getMonth()}`;
        label = this.getMonthLabel(entryDate.getMonth());
        order = entryDate.getFullYear() * 12 + entryDate.getMonth();
      } else if (currentGranularity === 'quarters') {
        const quarterIndex = Math.floor(entryDate.getMonth() / 3);
        key = `${entryDate.getFullYear()}-${quarterIndex}`;
        label = this.getQuarterLabel(quarterIndex);
        order = entryDate.getFullYear() * 4 + quarterIndex;
      } else {
        const weekIndex = Math.floor((entryTime - startTime) / (7 * dayMs));
        key = String(weekIndex);
        label = `Неделя ${weekIndex + 1}`;
        order = weekIndex;
      }

      const group = groups.get(key) || { label, order, total: 0, count: 0 };
      group.total += value;
      group.count += 1;
      groups.set(key, group);
    });

    const groupedValues = Array.from(groups.values()).sort((first, second) => first.order - second.order);
    return {
      labels: groupedValues.map((group) => group.label),
      values: groupedValues.map((group) => Math.round(group.total / group.count))
    };
  },
  getNumericValue(value) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  },
  sumMetric(items, field) {
    const values = (items || [])
      .map((item) => this.getNumericValue(item?.[field]))
      .filter((value) => value !== null);
    return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
  },
  averageMetric(items, field) {
    const values = (items || [])
      .map((item) => this.getNumericValue(item?.[field]))
      .filter((value) => value !== null);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  },
  sumFirstAvailableMetric(items, fields) {
    for (const field of fields) {
      const value = this.sumMetric(items, field);
      if (value !== null) {
        return value;
      }
    }
    return null;
  },
  getTasksForEmployees(employees, periodRange = null) {
    const employeeIds = new Set((employees || []).map((employee) => Number(employee.id)));
    const tasks = (this.mockData.tasks || []).filter((task) => employeeIds.has(Number(task.employeeId)));
    if (!periodRange) {
      return tasks;
    }
    return tasks.filter((task) => this.isDateWithinRange(task.dueDate, periodRange.startDate, periodRange.endDate));
  },
  isLateProjectTask(task) {
    return /просроч|не\s*в\s*срок|задерж/i.test(`${task?.status || ''} ${task?.indicator || ''}`);
  },
  isOnTimeProjectTask(task) {
    if (this.isLateProjectTask(task)) {
      return false;
    }
    return /в\s*срок|выполн|заверш/i.test(`${task?.status || ''} ${task?.indicator || ''}`);
  },
  countProjects(tasks, predicate = null) {
    const projects = new Set();
    (tasks || []).forEach((task) => {
      if (predicate && !predicate(task)) {
        return;
      }
      projects.add(task.project || `task-${task.id}`);
    });
    return projects.size;
  },
  getProjectMetrics(employees, tasks = this.getTasksForEmployees(employees)) {
    const projectHours = (tasks || []).reduce((sum, task) => sum + this.parseWorkHours(task.workTime), 0);
    return {
      projectCount: this.countProjects(tasks),
      previousProjectCount: this.sumFirstAvailableMetric(employees, ['previousProjectsTotal', 'previousProjectCount', 'previousProjectsCount']),
      projectsOnTime: this.countProjects(tasks, (task) => this.isOnTimeProjectTask(task)),
      previousProjectsOnTime: this.sumFirstAvailableMetric(employees, ['previousProjectsOnTime', 'previousOnTimeProjects']),
      projectsLate: this.countProjects(tasks, (task) => this.isLateProjectTask(task)),
      previousProjectsLate: this.sumFirstAvailableMetric(employees, ['previousProjectsLate', 'previousLateProjects', 'previousProjectsNotOnTime']),
      projectHours
    };
  },
  getManagementLoadByCenter(centerId) {
    const managements = this.getManagementsList().filter((management) => management.centerId === centerId);
    const employees = this.getNormalizedEmployees();
    return managements.map((management) => {
      const managementEmployees = employees.filter((employee) => {
        const employeeManagementId = String(employee.managementId || '');
        return employeeManagementId === management.id || employee.managementName === management.name || employee.management === management.name;
      });
      const averageLoad = this.averageMetric(managementEmployees, 'loadPercent');
      return {
        id: management.id,
        name: management.name,
        percent: averageLoad === null ? 0 : Math.round(averageLoad),
        employeesCount: managementEmployees.length
      };
    });
  },
  parseWorkHours(value) {
    const match = String(value || '').replace(',', '.').match(/-?\d+(\.\d+)?/);
    return match ? Number(match[0]) : 0;
  },
  pluralizeRu(count, one, few, many) {
    const n = Math.abs(Math.round(Number(count) || 0));
    const lastTwo = n % 100;
    const last = n % 10;
    if (lastTwo >= 11 && lastTwo <= 14) return many;
    if (last === 1) return one;
    if (last >= 2 && last <= 4) return few;
    return many;
  },
  pluralizeHours(count) {
    return this.pluralizeRu(count, 'час', 'часа', 'часов');
  },
  formatHours(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return `0 ${this.pluralizeHours(0)}`;
    }
    const displayValue = Number.isInteger(numericValue) ? numericValue : numericValue.toFixed(1);
    return `${displayValue} ${this.pluralizeHours(numericValue)}`;
  },
  getProjectDeadlineStatus(tasks) {
    const taskList = tasks || [];
    if (taskList.some((task) => this.isLateProjectTask(task))) {
      return 'Не в срок';
    }
    const indicators = [...new Set(taskList.map((task) => task.indicator).filter(Boolean))];
    if (indicators.length === 1) {
      return indicators[0];
    }
    if (taskList.some((task) => this.isOnTimeProjectTask(task))) {
      return 'В срок';
    }
    return indicators[0] || 'Без статуса';
  },
  getProjectHoursSummary(tasks) {
    const projects = new Map();
    (tasks || []).forEach((task) => {
      const projectName = task.project || 'Без проекта';
      const current = projects.get(projectName) || { project: projectName, hours: 0, tasks: [] };
      current.hours += this.parseWorkHours(task.workTime);
      current.tasks.push(task);
      projects.set(projectName, current);
    });
    return Array.from(projects.values()).map((project) => ({
      project: project.project,
      hours: project.hours,
      deadlineStatus: this.getProjectDeadlineStatus(project.tasks),
      isLate: project.tasks.some((task) => this.isLateProjectTask(task)),
      isOnTime: project.tasks.some((task) => this.isOnTimeProjectTask(task)) && !project.tasks.some((task) => this.isLateProjectTask(task))
    }));
  },
  getCenterProjectsSummary(centerId = '', periodRange = null) {
    const employees = this.getNormalizedEmployees();
    const center = centerId ? this.getCenterById(centerId) : null;
    const scopedEmployees = centerId
      ? employees.filter((employee) => employee.centerId === centerId || employee.centerName === center?.name)
      : employees;
    const tasks = this.getTasksForEmployees(scopedEmployees, periodRange);
    const projects = this.getProjectHoursSummary(tasks);
    return {
      centerId: centerId || '',
      title: center?.name || 'Технический блок',
      totalEmployees: scopedEmployees.length,
      totalProjects: projects.length,
      projectsOnTime: projects.filter((project) => project.isOnTime).length,
      projectsLate: projects.filter((project) => project.isLate).length,
      projects
    };
  },
  renderCenterSummaryCard(summary) {
    const projects = summary?.projects || [];
    return `
      <section class="wide-card center-summary-card">
        <div class="wide-card__head">
          <div>
            <h3>Общая сводка</h3>
            <p class="card__subtitle">${this.escapeHtml(summary?.title || 'Технический блок')}</p>
          </div>
        </div>
        <div class="center-summary-kpis">
          <div class="center-summary-kpi"><span>Задач всего</span><strong>${this.renderMetricValueMarkup(summary?.totalProjects || 0, 'всего')}</strong></div>
          <div class="center-summary-kpi"><span>Сотрудников всего</span><strong>${this.renderMetricValueMarkup(summary?.totalEmployees || 0, 'сотрудников')}</strong></div>
          <div class="center-summary-kpi"><span>Задачи в срок</span><strong>${this.renderMetricValueMarkup(summary?.projectsOnTime || 0, 'в срок')}</strong></div>
          <div class="center-summary-kpi center-summary-kpi--late"><span>Проектов не в срок</span><strong>${this.renderMetricValueMarkup(summary?.projectsLate || 0, 'не в срок')}</strong></div>
        </div>
        <div class="center-summary-table-wrap">
          ${projects.length ? `
            <table class="center-summary-table">
              <thead>
                <tr>
                  <th>Проект</th>
                  <th>Суммарные часы</th>
                  <th>Статус сроков</th>
                </tr>
              </thead>
              <tbody>
                ${projects.map((project) => `
                  <tr>
                    <td>${this.escapeHtml(project.project)}</td>
                    <td>${this.escapeHtml(this.formatHours(project.hours))}</td>
                    <td><span class="status-pill ${project.isLate ? 'status-pill--delay' : project.isOnTime ? 'status-pill--done' : 'status-pill--neutral'}">${this.escapeHtml(project.deadlineStatus)}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : '<div class="empty-state">По выбранному центру пока нет задач.</div>'}
        </div>
      </section>
    `;
  },
  buildDynamicKpis(employees, tasks = this.getTasksForEmployees(employees), periodRange = null, averageLoadOverride = null) {
    const employeeList = employees || [];
    const taskList = tasks || [];
    const projectMetrics = this.getProjectMetrics(employeeList, tasks);
    const tasksInProgress = taskList.filter((task) => /назнач|в\s*процессе|на\s*проверке/i.test(`${task.status || ''}`)).length;
    const tasksLate = taskList.filter((task) => this.isLateProjectTask(task)).length;
    const completedTaskCount = taskList.filter((task) => /заверш|выполн/i.test(`${task.status || ''}`)).length;
    const plannedHoursBase = this.sumMetric(employeeList, 'plannedHours');
    const actualHoursBase = this.sumMetric(employeeList, 'actualHours');
    const plannedHoursValue = periodRange ? this.getProratedHours(plannedHoursBase, periodRange) : plannedHoursBase;
    const actualHoursValue = periodRange ? this.getProratedHours(actualHoursBase, periodRange) : actualHoursBase;
    return [
      {
        key: 'plannedHours',
        label: 'Плановые часы',
        value: plannedHoursValue,
        previousValue: this.sumMetric(employeeList, 'previousPlannedHours'),
        suffix: this.pluralizeHours(plannedHoursValue)
      },
      {
        key: 'actualHours',
        label: 'Фактические часы',
        value: actualHoursValue,
        previousValue: this.sumMetric(employeeList, 'previousActualHours'),
        suffix: this.pluralizeHours(actualHoursValue)
      },
      {
        key: 'loadPercent',
        label: 'Загрузка',
        value: Number.isFinite(averageLoadOverride) ? averageLoadOverride : this.averageMetric(employeeList, 'loadPercent'),
        previousValue: this.averageMetric(employeeList, 'previousLoadPercent'),
        suffix: '%'
      },
      {
        key: 'tasksTotal',
        label: 'Задач всего',
        value: periodRange ? taskList.length : this.sumMetric(employeeList, 'tasksTotal'),
        previousValue: this.sumMetric(employeeList, 'previousTasksTotal'),
        suffix: 'всего'
      },
      {
        key: 'completedTasks',
        label: 'Выполнено задач',
        value: periodRange ? completedTaskCount : this.sumMetric(employeeList, 'completedTasks'),
        previousValue: this.sumMetric(employeeList, 'previousCompletedTasks'),
        suffix: 'выполнено'
      },
      {
        key: 'tasksInProgress',
        label: 'Задач в процессе',
        value: tasksInProgress,
        previousValue: null,
        suffix: 'в процессе'
      },
      {
        key: 'tasksLate',
        label: 'Просрочено / не в срок',
        value: tasksLate,
        previousValue: null,
        isNegativeMetric: true,
        suffix: 'просрочено'
      },
      {
        key: 'projectCount',
        label: 'Проектов всего',
        value: projectMetrics.projectCount,
        previousValue: projectMetrics.previousProjectCount,
        suffix: 'всего'
      },
      {
        key: 'projectsOnTime',
        label: 'Проекты в срок',
        value: projectMetrics.projectsOnTime,
        previousValue: projectMetrics.previousProjectsOnTime,
        suffix: 'в срок'
      },
      {
        key: 'projectsLate',
        label: 'Проекты не в срок',
        value: projectMetrics.projectsLate,
        previousValue: projectMetrics.previousProjectsLate,
        isNegativeMetric: true,
        suffix: 'не в срок'
      },
      {
        key: 'projectHours',
        label: 'Суммарные часы по проектам',
        value: projectMetrics.projectHours,
        previousValue: null,
        suffix: this.pluralizeHours(projectMetrics.projectHours)
      }
    ];
  },
  getEmployeeCoreMetrics(employees, tasks = this.getTasksForEmployees(employees), periodRange = null, averageLoadOverride = null) {
    const coreMetricKeys = new Set(['plannedHours', 'actualHours', 'loadPercent', 'tasksTotal', 'completedTasks', 'tasksInProgress', 'tasksLate']);
    return this.buildDynamicKpis(employees, tasks, periodRange, averageLoadOverride).filter((metric) => coreMetricKeys.has(metric.key));
  },
  formatMetricValue(value, suffix = '') {
    const numericValue = this.getNumericValue(value);
    if (numericValue === null) {
      return '—';
    }
    return `${Math.round(numericValue)}${suffix}`;
  },
  renderMetricValueMarkup(value, suffix = '') {
    const numericValue = this.getNumericValue(value);
    if (numericValue === null) {
      return '—';
    }
    const numberText = this.escapeHtml(`${Math.round(numericValue)}`);
    if (!suffix) {
      return numberText;
    }
    return `${numberText}<span class="metric-card__value-suffix">${this.escapeHtml(suffix)}</span>`;
  },
  renderKpiCard(metric, meta = '', compareCaption = 'по сравнению с прошлым периодом', inlineCompare = false) {
    const metricKey = metric.key ? String(metric.key) : '';
    const autoLoadClass = !metric.valueClass && (metricKey === 'loadPercent' || metricKey === 'averageLoad')
      ? this.getLoadLevelClass(metric.value)
      : '';
    const valueClass = metric.valueClass ? ` ${metric.valueClass}` : (autoLoadClass ? ` ${autoLoadClass}` : '');
    const metricKeyClass = metricKey ? ` metric-card--${this.escapeHtml(metricKey)}` : '';
    const valueRoleClass = metricKey === 'employeesCount' || metricKey === 'totalEmployees' ? ' employee-count-value' : '';
    const formattedValue = this.formatMetricValue(metric.value, metric.suffix || '');
    const percentValueClass = this.isPercentText(formattedValue) ? ' percent-value kpi-card__value--percent' : '';
    return `
      <article class="kpi-card metric-card${metricKeyClass}">
        <span class="kpi-card__icon" aria-hidden="true">${this.getKpiIconSvg(metricKey)}</span>
        <div class="kpi-card__label metric-card__label">${this.escapeHtml(metric.label)}</div>
        <div class="kpi-card__metric">
          <div class="kpi-card__value metric-card__value value-fit${valueClass}${valueRoleClass}${percentValueClass}">${this.renderMetricValueMarkup(metric.value, metric.suffix || '')}</div>
          <div class="metric-card__delta">${this.renderMetricDelta(metric.value, metric.previousValue, Boolean(metric.isNegativeMetric), compareCaption, inlineCompare)}</div>
        </div>
        ${meta ? `<div class="kpi-card__meta">${this.escapeHtml(meta)}</div>` : ''}
      </article>
    `;
  },
  getKpiIconSvg(key) {
    const icons = {
      plannedHours: '<rect x="2" y="3" width="12" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M2 6.5h12" stroke="currentColor" stroke-width="1.3"/><path d="M5 2v2.4M11 2v2.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
      actualHours: '<circle cx="8" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M8 5.3V8.5l3 1.7" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>',
      loadPercent: '<path d="M2.5 11.5a5.5 5.5 0 0 1 11 0" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M8 11.5 10.3 7.3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="8" cy="11.5" r="0.9" fill="currentColor" stroke="none"/>',
      averageLoad: '<path d="M2.5 11.5a5.5 5.5 0 0 1 11 0" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M8 11.5 10.3 7.3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="8" cy="11.5" r="0.9" fill="currentColor" stroke="none"/>',
      totalEmployees: '<circle cx="6" cy="5.6" r="2.1" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M2.3 13.2c0-2.3 1.7-3.9 3.7-3.9s3.7 1.6 3.7 3.9" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="11.3" cy="5.1" r="1.7" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M9.6 9.6c.6-.5 1.3-.8 2.1-.8 1.7 0 3.1 1.3 3.3 3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>',
      employeesCount: '<circle cx="6" cy="5.6" r="2.1" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M2.3 13.2c0-2.3 1.7-3.9 3.7-3.9s3.7 1.6 3.7 3.9" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="11.3" cy="5.1" r="1.7" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M9.6 9.6c.6-.5 1.3-.8 2.1-.8 1.7 0 3.1 1.3 3.3 3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>',
      tasksTotal: '<rect x="2.5" y="2.5" width="11" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M5 6h6M5 8.3h6M5 10.6h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>',
      activeTasks: '<rect x="2.5" y="2.5" width="11" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M5 6h6M5 8.3h6M5 10.6h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>',
      completedTasks: '<circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M5.5 8.2l1.8 1.8 3.2-3.6" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>',
      tasksInProgress: '<circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M8 8V4.2A3.8 3.8 0 0 1 11.8 8H8Z" fill="currentColor" stroke="none"/>',
      tasksLate: '<path d="M8 2.6 14 13H2L8 2.6Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M8 6.4v3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="8" cy="11.1" r="0.7" fill="currentColor" stroke="none"/>',
      centersCount: '<circle cx="4" cy="4" r="2" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="12" cy="4" r="2" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="12" r="2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5.6 5.4L6.8 10.2M10.4 5.4L9.2 10.2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>',
      managementsCount: '<rect x="6" y="2" width="4" height="3" rx="0.8" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="2" y="10.5" width="4" height="3" rx="0.8" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="10" y="10.5" width="4" height="3" rx="0.8" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M8 5v2.5M8 7.5H4v3M8 7.5h4v3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>'
    };
    const markup = icons[key] || '<path d="M3 13V9M8 13V5M13 13V7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>';
    return `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">${markup}</svg>`;
  },
  renderMetricsPanel(metrics = [], options = {}) {
    const compareCaption = options.compareCaption || 'по сравнению с прошлым периодом';
    const inlineCompare = Boolean(options.inlineCompare);
    const hiddenMetricKeys = new Set(['efficiency', 'projectCount', 'projectsOnTime', 'projectsLate', 'projectHours']);
    const visibleMetrics = (metrics || []).filter((metric) => metric && !hiddenMetricKeys.has(metric.key));
    const groups = [
      {
        title: 'Общие показатели',
        keys: ['plannedHours', 'actualHours', 'loadPercent', 'averageLoad', 'totalEmployees']
      },
      {
        title: 'Задачи',
        keys: ['tasksTotal', 'completedTasks', 'tasksInProgress', 'tasksLate']
      }
    ];
    const renderedGroups = groups.map((group) => {
      const groupMetrics = group.keys
        .map((key) => visibleMetrics.find((metric) => metric.key === key))
        .filter(Boolean);
      if (!groupMetrics.length) return '';
      return `
        <div class="metrics-group">
          <div class="metrics-group__title">${this.escapeHtml(group.title)}</div>
          <div class="metrics-grid">
            ${groupMetrics.map((metric) => this.renderKpiCard(metric, '', compareCaption, inlineCompare)).join('')}
          </div>
        </div>
      `;
    }).filter(Boolean);
    const uncategorizedMetrics = visibleMetrics.filter((metric) => !groups.some((group) => group.keys.includes(metric.key)));
    if (uncategorizedMetrics.length) {
      renderedGroups.push(`
        <div class="metrics-group">
          <div class="metrics-group__title">Дополнительно</div>
          <div class="metrics-grid">
            ${uncategorizedMetrics.map((metric) => this.renderKpiCard(metric, '', compareCaption, inlineCompare)).join('')}
          </div>
        </div>
      `);
    }
    if (!renderedGroups.length) return '';
    return `
      <section class="metrics-panel ${options.className ? this.escapeHtml(options.className) : ''}">
        ${renderedGroups.map((groupMarkup, index) => `${index > 0 ? '<div class="metrics-separator" aria-hidden="true"></div>' : ''}${groupMarkup}`).join('')}
      </section>
    `;
  },
  renderEmployeeMetricsPanel(metrics = []) {
    const visibleMetrics = (metrics || []).filter((metric) => metric && metric.key !== 'efficiency');
    const compareCaption = this.getComparisonCaption(this.state.employeePeriod);
    const groups = [
      {
        title: 'Часы и загрузка',
        keys: ['plannedHours', 'actualHours', 'loadPercent'],
        gridClass: 'employee-metric-grid--hours',
        groupClass: 'employee-metric-group--hours'
      },
      {
        title: 'Задачи',
        keys: ['tasksTotal', 'completedTasks', 'tasksInProgress', 'tasksLate'],
        gridClass: 'employee-metric-grid--tasks',
        groupClass: 'employee-metric-group--tasks'
      }
    ];
    const renderedGroups = groups.map((group) => {
      const groupMetrics = group.keys
        .map((key) => visibleMetrics.find((metric) => metric.key === key))
        .filter(Boolean);
      if (!groupMetrics.length) return '';
      return `
        <section class="metrics-group employee-metric-group ${this.escapeHtml(group.groupClass || '')}">
          <div class="metrics-group__title employee-metric-group__title">${this.escapeHtml(group.title)}</div>
          <div class="metrics-grid employee-metric-grid ${this.escapeHtml(group.gridClass || '')}">
            ${groupMetrics.map((metric) => this.renderKpiCard(metric, '', compareCaption, true)).join('')}
          </div>
        </section>
      `;
    }).filter(Boolean);
    if (!renderedGroups.length) return '';
    return `
      <section class="metrics-panel metrics-panel--employee employee-metrics-section">
        ${renderedGroups.join('<div class="employee-metrics-divider" aria-hidden="true"></div>')}
      </section>
    `;
  },
  buildEmployeesCompactKpis(employees = [], periodRange = null) {
    const employeeList = employees || [];
    const centerCount = new Set(employeeList.map((employee) => employee.centerId || employee.centerName || employee.center).filter(Boolean)).size;
    const managementCount = new Set(employeeList.map((employee) => employee.managementId || employee.managementName || employee.management).filter(Boolean)).size;
    const activeTasks = this.getTasksForEmployees(employeeList, periodRange).filter((task) => !/заверш|выполн/i.test(`${task.status || ''}`)).length;
    return [
      { key: 'employeesCount', label: 'Всего сотрудников', value: employeeList.length, previousValue: null, suffix: 'сотрудников' },
      { key: 'centersCount', label: 'Центров', value: centerCount, previousValue: null, suffix: 'центров' },
      { key: 'managementsCount', label: 'Управлений', value: managementCount, previousValue: null, suffix: 'управлений' },
      { key: 'activeTasks', label: 'Активных задач', value: activeTasks, previousValue: null, suffix: 'задач' }
    ];
  },
  renderPreviewMetricCard(metric, compareCaption = 'по сравнению с прошлым периодом') {
    const formattedValue = this.formatMetricValue(metric.value, metric.suffix || '');
    const percentValueClass = this.isPercentText(formattedValue) ? ' percent-value preview-metric-card__value--percent' : '';
    const metricKey = metric.key ? String(metric.key) : '';
    const autoLoadClass = (metricKey === 'loadPercent' || metricKey === 'averageLoad')
      ? ` ${this.getLoadLevelClass(metric.value)}`
      : '';
    return `
      <div class="preview-metric-card">
        <span class="kpi-card__icon" aria-hidden="true">${this.getKpiIconSvg(metricKey)}</span>
        <div class="preview-metric-card__label">${this.escapeHtml(metric.label)}</div>
        <div class="preview-metric-card__value value-fit${percentValueClass}${autoLoadClass}">${this.renderMetricValueMarkup(metric.value, metric.suffix || '')}</div>
        ${this.renderMetricDelta(metric.value, metric.previousValue, Boolean(metric.isNegativeMetric), compareCaption, true)}
      </div>
    `;
  },
  buildTechBlockOverviewKpis(summary) {
    return [
      {
        key: 'totalEmployees',
        label: 'Всего сотрудников',
        value: this.mockData.employees?.length ?? summary.totalEmployees,
        previousValue: null,
        suffix: 'сотрудников'
      },
      {
        key: 'averageLoad',
        label: 'Средняя загрузка',
        value: summary.periodAverageLoad ?? summary.averageLoad,
        previousValue: summary.previousAverageLoad,
        suffix: '%',
        valueClass: this.getLoadLevelClass(summary.periodAverageLoad ?? summary.averageLoad)
      }
    ];
  },
  getAnalyticsKpis(summary) {
    if (summary.id !== 'techBlock') {
      const dynamicKpis = (summary.dynamicKpis || []).filter((metric) => metric.key !== 'efficiency');
      return [...dynamicKpis, this.buildTotalEmployeesKpi(summary)];
    }
    const dynamicKpis = (summary.dynamicKpis || []).filter((metric) => metric.key !== 'loadPercent' && metric.key !== 'efficiency');
    return [...this.buildTechBlockOverviewKpis(summary), ...dynamicKpis];
  },
  buildTotalEmployeesKpi(summary) {
    return {
      key: 'totalEmployees',
      label: 'Всего сотрудников',
      value: summary.totalEmployees,
      previousValue: null,
      suffix: 'сотрудников'
    };
  },
  renderPeriodPresetSwitcher(level) {
    const settings = this.getDynamicSettings(level);
    const options = [
      { key: 'month', label: 'Месяц' },
      { key: 'quarter', label: 'Квартал' },
      { key: 'year', label: 'Год' },
      { key: 'custom', label: 'Свой период' }
    ];
    return `
      <div class="period-preset-switcher" data-dynamic-level="${this.escapeHtml(level)}">
        ${options.map((option) => `
          <button type="button" class="period-preset-btn ${settings.periodPreset === option.key ? 'is-active' : ''}" data-dynamic-level="${this.escapeHtml(level)}" data-period-preset="${option.key}">
            ${this.escapeHtml(option.label)}
          </button>
        `).join('')}
      </div>
    `;
  },
  renderGranularitySwitcher(level) {
    const settings = this.getDynamicSettings(level);
    const current = this.normalizeGranularity(settings.granularity);
    const allOptions = [
      { key: 'days', label: 'По дням' },
      { key: 'weeks', label: 'По неделям' },
      { key: 'months', label: 'По месяцам' },
      { key: 'quarters', label: 'По кварталам' }
    ];
    const allowedGranularities = this.getAllowedGranularities(settings.periodPreset);
    const options = allOptions.filter((option) => allowedGranularities.includes(option.key));
    return `
      <div class="granularity-switcher" data-dynamic-level="${this.escapeHtml(level)}">
        ${options.map((option) => `
          <button type="button" class="granularity-btn ${current === option.key ? 'is-active' : ''}" data-dynamic-level="${this.escapeHtml(level)}" data-dynamic-granularity="${option.key}">
            ${this.escapeHtml(option.label)}
          </button>
        `).join('')}
      </div>
    `;
  },
  renderPeriodUnitSelector(level) {
    const settings = this.getDynamicSettings(level);
    const optionsMarkup = this.getPeriodUnitOptionsMarkup(settings.periodPreset, settings.periodUnit);
    if (!optionsMarkup) {
      return '';
    }
    return `
      <select class="period-unit-select" data-dynamic-level="${this.escapeHtml(level)}" data-period-unit-select>
        ${optionsMarkup}
      </select>
    `;
  },
  renderDynamicControls(level) {
    const settings = this.getDynamicSettings(level);
    const isCustom = settings.periodPreset === 'custom';
    const unitSelector = this.renderPeriodUnitSelector(level);
    const customDateFields = `
      <div class="custom-period-fields custom-period-fields--inline">
        <label>
          <span>Дата начала</span>
          <input class="date-fit" type="date" value="${this.escapeHtml(settings.startDate)}" data-dynamic-level="${this.escapeHtml(level)}" data-custom-period-start>
        </label>
        <label>
          <span>Дата окончания</span>
          <input class="date-fit" type="date" value="${this.escapeHtml(settings.endDate)}" data-dynamic-level="${this.escapeHtml(level)}" data-custom-period-end>
        </label>
      </div>
    `;
    const middleGroup = isCustom
      ? `
        <span class="dynamic-controls__divider" aria-hidden="true"></span>
        <div class="dynamic-controls__group dynamic-controls__group--custom-dates">
          ${customDateFields}
        </div>
      `
      : (unitSelector ? `
        <span class="dynamic-controls__divider" aria-hidden="true"></span>
        <div class="dynamic-controls__group dynamic-controls__group--unit">
          <span class="dynamic-controls__label">${settings.periodPreset === 'month' ? 'Месяц' : settings.periodPreset === 'quarter' ? 'Квартал' : 'Год'}</span>
          ${unitSelector}
        </div>
      ` : '');
    return `
      <div class="dynamic-controls" data-dynamic-level="${this.escapeHtml(level)}">
        <div class="dynamic-controls__panel">
          <div class="dynamic-controls__group dynamic-controls__group--period">
            <span class="dynamic-controls__label">Период</span>
            ${this.renderPeriodPresetSwitcher(level)}
          </div>
          ${middleGroup}
          <span class="dynamic-controls__divider" aria-hidden="true"></span>
          <div class="dynamic-controls__group dynamic-controls__group--granularity">
            <span class="dynamic-controls__label">Детализация</span>
            ${this.renderGranularitySwitcher(level)}
          </div>
        </div>
      </div>
    `;
  },
  renderEmployeeLoadGranularitySwitcher() {
    return this.renderGranularitySwitcher('employee');
  },
  updateDynamicControlsState(level, root = document) {
    const settings = this.getDynamicSettings(level);
    root.querySelectorAll(`[data-period-preset][data-dynamic-level="${level}"]`).forEach((button) => {
      button.classList.toggle('is-active', button.dataset.periodPreset === settings.periodPreset);
    });
    root.querySelectorAll(`[data-dynamic-granularity][data-dynamic-level="${level}"]`).forEach((button) => {
      button.classList.toggle('is-active', button.dataset.dynamicGranularity === settings.granularity);
    });
    root.querySelectorAll(`[data-period-unit-select][data-dynamic-level="${level}"]`).forEach((select) => {
      if (Number.isInteger(settings.periodUnit)) {
        select.value = String(settings.periodUnit);
      }
    });
    root.querySelectorAll(`.dynamic-controls[data-dynamic-level="${level}"] .custom-period-fields`).forEach((fields) => {
      const isCustomPeriod = settings.periodPreset === 'custom';
      fields.classList.toggle('is-hidden', !isCustomPeriod);
      fields.classList.toggle('is-visible', isCustomPeriod);
      const startInput = fields.querySelector('[data-custom-period-start]');
      const endInput = fields.querySelector('[data-custom-period-end]');
      if (startInput) {
        startInput.value = settings.startDate;
      }
      if (endInput) {
        endInput.value = settings.endDate;
      }
    });
    this.initSwitchIndicators(root);
  },
  attachDynamicControlsListeners(level, container, sourceData, chartId) {
    container.querySelectorAll(`[data-period-preset][data-dynamic-level="${level}"]`).forEach((button) => {
      button.addEventListener('click', () => {
        this.setDynamicPeriod(level, button.dataset.periodPreset);
        this.refreshDynamicControls(level, this.resolveLiveViewLayer(container), sourceData, chartId);
      });
    });
    container.querySelectorAll(`[data-dynamic-granularity][data-dynamic-level="${level}"]`).forEach((button) => {
      button.addEventListener('click', () => {
        this.setDynamicGranularity(level, button.dataset.dynamicGranularity);
        this.updateDynamicChart(level, chartId, sourceData, this.resolveLiveViewLayer(container));
      });
    });
    container.querySelectorAll(`[data-period-unit-select][data-dynamic-level="${level}"]`).forEach((select) => {
      select.addEventListener('change', () => {
        this.setDynamicPeriodUnit(level, select.value);
        this.updateDynamicChart(level, chartId, sourceData, this.resolveLiveViewLayer(container));
      });
    });
    container.querySelectorAll(`.dynamic-controls[data-dynamic-level="${level}"] input[type="date"]`).forEach((input) => {
      input.addEventListener('change', () => {
        const fields = input.closest('.custom-period-fields');
        const startInput = fields?.querySelector('[data-custom-period-start]');
        const endInput = fields?.querySelector('[data-custom-period-end]');
        this.setCustomDynamicPeriod(level, startInput?.value || '', endInput?.value || '');
        this.updateDynamicChart(level, chartId, sourceData, this.resolveLiveViewLayer(container));
      });
    });
  },
  refreshDynamicControls(level, container, sourceData, chartId) {
    const panel = container.querySelector(`.dynamic-controls[data-dynamic-level="${level}"]`);
    if (panel) {
      panel.outerHTML = this.renderDynamicControls(level);
    }
    this.attachDynamicControlsListeners(level, container, sourceData, chartId);
    this.updateDynamicChart(level, chartId, sourceData, container);
  },
  updateDynamicChart(level = 'techBlock', chartId = 'dynamicLoadChart', sourceData = null, root = document) {
    if (!['techBlock', 'center', 'employee'].includes(level)) {
      const summary = this.state.activeAnalyticsSummary || this.getTechBlockSummary();
      const summaryLevel = summary.id === 'techBlock' ? 'techBlock' : 'center';
      this.setDynamicGranularity(summaryLevel, level);
      this.updateDynamicChart(summaryLevel, chartId, summary, root);
      return;
    }

    const settings = this.getDynamicSettings(level);
    const chartSource = sourceData || (level === 'employee'
      ? this.state.activeEmployee
      : this.state.activeAnalyticsSummary || this.getTechBlockSummary());
    const chartData = this.getDynamicChartData(chartSource, settings.startDate, settings.endDate, settings.granularity);
    const fallbackValues = this.getDynamicValues(chartSource, settings.granularity);
    const values = chartData.values.length ? chartData.values : fallbackValues;
    const labels = chartData.labels.length
      ? chartData.labels
      : this.getDynamicLabels(chartSource, settings.granularity).slice(0, values.length);
    const chartLabels = labels.length ? labels : this.getDefaultDynamicLabels(settings.granularity, values.length);
    const canvas = root.querySelector?.(`#${chartId}`) || document.getElementById(chartId);
    const chartCard = canvas?.closest('.data-viz-card');

    if (canvas) {
      chartCard?.classList.add('is-updating');
      StaffCharts.updateLine(canvas, chartLabels.slice(0, values.length), values, level === 'employee' ? 'Загруженность' : 'Загрузка');
      window.setTimeout(() => chartCard?.classList.remove('is-updating'), 360);
    }

    const subtitleId = level === 'employee' ? 'employeeHistorySubtitle' : 'dynamicLoadSubtitle';
    const subtitle = root.querySelector?.(`#${subtitleId}`) || document.getElementById(subtitleId);
    if (subtitle) {
      subtitle.textContent = this.formatDynamicSubtitle(settings);
    }

    const averageId = level === 'employee' ? 'employeeHistoryAverage' : 'dynamicLoadAverage';
    const averageBadge = root.querySelector?.(`#${averageId}`) || document.getElementById(averageId);
    if (averageBadge) {
      const average = values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
      averageBadge.textContent = averageBadge.classList.contains('data-viz-card__metric-value')
        ? (average !== null ? `${average}%` : '—')
        : (average !== null ? `Среднее ${average}%` : 'Нет данных');
      const averageLabel = averageBadge.closest('.data-viz-card__metric')?.querySelector('.data-viz-card__metric-label');
      if (averageLabel) {
        averageLabel.textContent = this.getAveragePeriodLabel(settings);
      }
    }

    this.updateDynamicControlsState(level, root);
  },
  normalizeProjectTypes(period) {
    return (period.projectTypes || period.types || []).map((item) => ({
      name: item.name || item.label,
      percent: Number(item.percent ?? item.value ?? 0)
    }));
  },
  aggregatePercentBreakdown(periods, key) {
    const totals = new Map();
    const totalWeight = periods.reduce((sum, period) => sum + Number(period.fact || 0), 0);
    periods.forEach((period) => {
      const weight = Number(period.fact || 0);
      (period[key] || []).forEach((item) => {
        const name = item.name || item.label;
        const value = Number(item.percent ?? item.value ?? 0);
        totals.set(name, (totals.get(name) || 0) + (weight * value / 100));
      });
    });
    return Array.from(totals, ([name, value]) => ({
      name,
      percent: totalWeight ? Math.round((value / totalWeight) * 100) : 0
    }));
  },
  getCenterSummary(centerId, periodRange = null) {
    const center = this.getCenterById(centerId);
    const centerIndex = Math.max(0, this.getCentersList().findIndex((item) => item.id === centerId));
    const employees = this.getNormalizedEmployees().filter((employee) => employee.centerId === centerId || employee.centerName === center?.name);
    const nonAdminEmployees = employees.filter((employee) => !this.isAdminEmployee(employee));
    const averageLoad = employees.length
      ? Math.round(employees.reduce((sum, employee) => sum + Number(employee.loadPercent || 0), 0) / employees.length)
      : 0;
    const previousAverageLoad = this.averageMetric(employees, 'previousLoadPercent');
    const periods = this.getPeriodCards().map((period, index) => {
      const plan = Math.round(Number(period.plan || 0) * employees.length);
      const basePercent = Number(period.percent || averageLoad || 0);
      const percent = plan ? Math.max(0, Math.min(100, Math.round((averageLoad * 0.35) + (basePercent * 0.65) + ((centerIndex % 3) - 1) * 2))) : 0;
      const fact = Math.round(plan * percent / 100);
      const absence = Math.round(Number(period.missing ?? period.absence ?? 0) * employees.length);
      const idle = Math.max(0, Math.round(plan - fact));
      return {
        id: `center-${centerId}-${index}`,
        title: period.title,
        subtitle: period.subtitle,
        percent,
        fact,
        plan,
        idle,
        absence,
        projectTypes: this.normalizeProjectTypes(period),
        centers: [{ name: center?.name || 'Текущий центр', percent }]
      };
    });
    const periodTasks = this.getTasksForEmployees(employees, periodRange);
    const periodAverageLoad = periodRange
      ? (this.getAverageLoadForRange(center?.dynamicLoad, periodRange.startDate, periodRange.endDate) ?? averageLoad)
      : averageLoad;
    return {
      id: centerId,
      title: center?.name || 'Центр',
      totalEmployees: employees.length,
      activeEmployees: nonAdminEmployees.length,
      adminEmployees: employees.length - nonAdminEmployees.length,
      averageLoad,
      previousAverageLoad,
      periodAverageLoad,
      dynamicLoad: center?.dynamicLoad || null,
      dynamicKpis: this.buildDynamicKpis(employees, periodTasks, periodRange, periodAverageLoad),
      managementLoads: this.getManagementLoadByCenter(centerId),
      projectSummary: this.getCenterProjectsSummary(centerId, periodRange),
      periods,
      quarterlyLoad: this.getQuarterlyLoad().map((item, index) => ({
        label: item.label,
        percent: Math.max(0, Math.min(100, Math.round((averageLoad || item.percent) * 0.75 + item.percent * 0.25 + index * 2)))
      }))
    };
  },
  getTechBlockSummary(periodRange = null) {
    const centerSummaries = this.getCentersList().map((center) => this.getCenterSummary(center.id));
    const baseSummary = this.mockData.techBlockSummary || {};
    const employees = this.getNormalizedEmployees();
    const nonAdminEmployees = employees.filter((employee) => !this.isAdminEmployee(employee));
    const averageLoad = this.averageMetric(employees, 'loadPercent');
    const previousAverageLoad = this.averageMetric(employees, 'previousLoadPercent');
    const periods = this.getPeriodCards().map((period, index) => {
      const centerPeriods = centerSummaries.map((summary) => summary.periods[index]).filter(Boolean);
      const fact = centerPeriods.reduce((sum, item) => sum + Number(item.fact || 0), 0);
      const plan = centerPeriods.reduce((sum, item) => sum + Number(item.plan || 0), 0);
      const idle = centerPeriods.reduce((sum, item) => sum + Number(item.idle || 0), 0);
      const absence = centerPeriods.reduce((sum, item) => sum + Number(item.absence || 0), 0);
      return {
        id: `tech-block-${index}`,
        title: period.title,
        subtitle: period.subtitle,
        percent: plan ? Math.round((fact / plan) * 100) : 0,
        fact,
        plan,
        idle,
        absence,
        projectTypes: this.aggregatePercentBreakdown(centerPeriods, 'projectTypes'),
        centers: centerSummaries.map((summary) => ({
          name: summary.title,
          percent: summary.periods[index]?.percent || 0
        }))
      };
    });
    const techBlockDynamicLoad = baseSummary.dynamicLoad || this.mockData.dynamicLoad || null;
    const periodTasks = this.getTasksForEmployees(employees, periodRange);
    const periodAverageLoad = periodRange
      ? (this.getAverageLoadForRange(techBlockDynamicLoad, periodRange.startDate, periodRange.endDate) ?? averageLoad)
      : averageLoad;
    return {
      id: 'techBlock',
      title: baseSummary.title || 'Технический блок',
      totalEmployees: employees.length,
      activeEmployees: nonAdminEmployees.length,
      adminEmployees: employees.length - nonAdminEmployees.length,
      averageLoad,
      previousAverageLoad,
      periodAverageLoad,
      dynamicLoad: techBlockDynamicLoad,
      dynamicKpis: this.buildDynamicKpis(employees, periodTasks, periodRange, periodAverageLoad),
      managementLoads: [],
      projectSummary: this.getCenterProjectsSummary('', periodRange),
      periods,
      quarterlyLoad: this.getQuarterlyLoad().map((quarter, index) => {
        const values = centerSummaries.map((summary) => Number(summary.quarterlyLoad[index]?.percent || 0));
        const total = values.reduce((sum, value) => sum + value, 0);
        return {
          label: quarter.label,
          percent: values.length ? Math.round(total / values.length) : 0
        };
      })
    };
  },
  renderAnalyticsPage(summary, targetContainer = null, options = {}) {
    const container = targetContainer || this.getCurrentViewLayer();
    if (!container) return;
    if (!options.preserveExistingCharts) {
      StaffCharts.destroyAll();
    }
    const overviewLevel = summary.id === 'techBlock' ? 'techBlock' : 'center';
    const overviewSettings = this.getOverviewPeriodSettings(overviewLevel);
    const overviewRange = { startDate: overviewSettings.startDate, endDate: overviewSettings.endDate };
    summary = overviewLevel === 'techBlock'
      ? this.getTechBlockSummary(overviewRange)
      : this.getCenterSummary(summary.id, overviewRange);
    const isTechBlock = summary.id === 'techBlock';
    const analyticsKpis = this.getAnalyticsKpis(summary);
    const dynamicLevel = isTechBlock ? 'techBlock' : 'center';
    const dynamicSettings = this.getDynamicSettings(dynamicLevel);
    const dynamicAverage = this.getDynamicAverageValue(summary, dynamicSettings);
    this.state.activeAnalyticsSummary = summary;
    const periodsSource = summary.periods || [];
    const periodDisplayOrder = [3, 0, 1, 2, 4].filter((index) => periodsSource[index]);
    const cardsMarkup = periodDisplayOrder.map((index) => {
      const card = periodsSource[index];
      return `
      <article class="card data-viz-card data-viz-card--period data-viz-card--period-${this.getPeriodTemporalGroup(index).key}">
        ${this.renderPeriodCardGroupBadge(index)}
        <div class="data-viz-card__header">
          <div class="data-viz-card__header-text">
            <h3 class="data-viz-card__title">${this.escapeHtml(card.title)}</h3>
            <p class="data-viz-card__subtitle">${this.escapeHtml(card.subtitle || '')}</p>
          </div>
        </div>
        <div class="data-viz-card__body donut-layout">
          <div class="donut-layout__chart chart-frame chart-frame--donut">
            <canvas data-chart="doughnut" data-index="${this.escapeHtml(card.id)}"></canvas>
            ${this.renderDonutCenter(`${card.percent}%`, 'загрузка', this.getLoadLevelClass(card.percent))}
          </div>
          <div class="donut-layout__legend">
            <div class="analytics-list-title">Виды проектов</div>
            ${this.renderChartLegend(card.projectTypes || [])}
          </div>
        </div>
        <div class="card__stats">
          <div class="stat-row"><span>Факт</span><strong>${this.formatHours(card.fact)}</strong></div>
          <div class="stat-row"><span>План</span><strong>${this.formatHours(card.plan)}</strong></div>
          <div class="stat-row"><span>Простой</span><strong>${this.formatHours(card.idle)}</strong></div>
          <div class="stat-row"><span>Отсутствие</span><strong>${this.formatHours(card.absence)}</strong></div>
        </div>
        <div class="analytics-list-title">${isTechBlock ? 'Загрузка центров' : 'Загрузка управлений'}</div>
        <div class="card__list">
          ${(isTechBlock ? (card.centers || []) : (summary.managementLoads || [])).length ? (isTechBlock ? (card.centers || []) : (summary.managementLoads || [])).map((item) => `
            <div class="list-item">
              <span class="list-item__label">${this.escapeHtml(item.name)}</span>
              ${this.renderPercentBadge(`${item.percent}%`, this.getLoadLevelClass(item.percent))}
            </div>
          `).join('') : `
            <div class="list-item">
              <span class="list-item__label">Нет данных</span>
              <span class="badge">—</span>
            </div>
          `}
        </div>
      </article>
    `;
    }).join('');

    container.innerHTML = `
      <section class="center-page-shell analytics-content center-content-transition is-visible">
        ${isTechBlock ? '' : this.renderTopCenterTabs()}
        <div class="analytics-heading">
          <div>
            <p class="section-subtitle">${this.escapeHtml(isTechBlock ? 'Сводная аналитика по всем центрам' : 'Аналитика выбранного центра')}</p>
            <h2 class="section-title">${this.escapeHtml(isTechBlock ? 'Загрузка тех. блока' : `Загрузка: ${summary.title}`)}</h2>
          </div>
        </div>
        ${this.renderOverviewPeriodBar(overviewLevel)}
        ${this.renderMetricsPanel(analyticsKpis, { compareCaption: this.getComparisonCaption(overviewSettings.periodPreset), inlineCompare: true })}
        <section class="hero-grid dashboard-periods-grid">
          ${cardsMarkup}
        </section>
        ${this.renderCenterSummaryCard(summary.projectSummary)}
        <section class="wide-card data-viz-card data-viz-card--wide">
          <div class="data-viz-card__header">
            <div>
              <h3 class="data-viz-card__title">Динамика загрузки</h3>
              <p class="data-viz-card__subtitle" id="dynamicLoadSubtitle">${this.escapeHtml(this.formatDynamicSubtitle(dynamicSettings))}</p>
            </div>
            ${this.renderDataVizMetric(dynamicAverage !== null ? `${dynamicAverage}%` : '—', this.getAveragePeriodLabel(dynamicSettings), 'dynamicLoadAverage')}
          </div>
          ${this.renderDynamicControls(dynamicLevel)}
          <div class="data-viz-card__body chart-frame chart-frame--wide">
            <div class="chart-large"><canvas id="dynamicLoadChart"></canvas></div>
          </div>
        </section>
      </section>
    `;

    container.querySelectorAll('.center-tab').forEach((button) => {
      button.addEventListener('click', () => this.setCurrentCenter(button.dataset.centerId));
    });
    this.attachOverviewPeriodListeners(overviewLevel, container, () => this.renderAnalyticsPage(summary, this.resolveLiveViewLayer(container), options));
    this.attachDynamicControlsListeners(dynamicLevel, container, summary, 'dynamicLoadChart');
    const cards = container.querySelectorAll('[data-chart="doughnut"]');
    const periodsById = new Map((summary.periods || []).map((item) => [String(item.id), item]));
    cards.forEach((canvas) => {
      const card = periodsById.get(canvas.dataset.index);
      if (!card) return;
      const labels = (card.projectTypes || []).map((item) => item.name);
      const values = (card.projectTypes || []).map((item) => item.percent);
      const colors = this.getChartPaletteSequence();
      StaffCharts.createDoughnut(canvas, labels, values, colors, { fillPercent: card.percent });
    });
    this.updateDynamicChart(dynamicLevel, 'dynamicLoadChart', summary, container);
    this.initCenterTabsAnimation(container);
    this.activateAnalyticsContent();
  },
  renderTechBlockPage() {
    const title = document.getElementById('pageTitle');
    if (title) title.textContent = 'Технический блок';
    this.renderAnalyticsPage(this.getTechBlockSummary());
  },
  renderCenterPage(centerId) {
    const center = this.getCenterById(centerId);
    const title = document.getElementById('pageTitle');
    if (title) title.textContent = center ? center.name : 'Центр';
    this.renderAnalyticsPage(this.getCenterSummary(centerId));
  },
  renderDashboardPage() {
    const currentCenter = this.getCurrentCenter();
    if (currentCenter) {
      this.renderCenterPage(currentCenter.id);
      return;
    }
    this.renderTechBlockPage();
  },
  renderEmployeesPageWithTransition() {
    this.closeTaskModal({ immediate: true });
    this.closeEmployeePreview({ immediate: true });
    this.state.currentPage = 'employees';
    document.body.dataset.page = 'employees';
    this.state.currentCenter = '';
    const title = document.getElementById('pageTitle');
    if (title) title.textContent = 'Сотрудники';
    this.replaceBrowserUrl(this.buildPageHref('employees', ''));
    this.updateSidebarActiveState();
    return this.renderWithTransition(
      (targetLayer) => {
        this.renderEmployeesPage(targetLayer);
      },
      {
        beforeDirectRender: () => StaffCharts.destroyAll(),
        afterCommit: () => this.updateSidebarActiveState()
      }
    );
  },
  renderEmployeesPage(container) {
    const employees = this.getNormalizedEmployees();
    const filterBlock = this.getFilteredEmployees();
    const managements = this.getManagementsList();
    const statuses = [...new Set(employees.map((employee) => employee.status))];
    const overviewSettings = this.getOverviewPeriodSettings('employees');
    const overviewRange = { startDate: overviewSettings.startDate, endDate: overviewSettings.endDate };
    const employeePageKpis = this.buildEmployeesCompactKpis(filterBlock, overviewRange);

    container.innerHTML = `
      <a class="page-back" href="dashboard.html">← Назад</a>
      ${this.renderOverviewPeriodBar('employees')}
      <div class="kpi-grid employees-compact-kpis">
        ${employeePageKpis.map((metric) => this.renderKpiCard(metric)).join('')}
      </div>
      <section class="employees-card">
        <div class="employees-toolbar">
          <div class="employees-search field">
            <label for="employeeSearch">Поиск</label>
            <input id="employeeSearch" type="text" placeholder="Введите ФИО" value="${this.escapeHtml(this.state.filters.search)}">
          </div>
          <div class="employees-filter field">
            <label for="filterCenter">Центр</label>
            <select id="filterCenter">
              ${this.populateCenterFilter()}
            </select>
          </div>
          <div class="employees-filter field">
            <label for="filterManagement">Управление</label>
            <select id="filterManagement">
              ${this.populateManagementFilter()}
            </select>
          </div>
          <div class="employees-filter field">
            <label for="filterStatus">Статус</label>
            <select id="filterStatus">
              <option value="">Все статусы</option>
              ${statuses.map((status) => `<option value="${this.escapeHtml(status)}" ${this.state.filters.status === status ? 'selected' : ''}>${this.escapeHtml(status)}</option>`).join('')}
            </select>
          </div>
          <button class="button button--primary employees-reset" id="resetFilters">Сбросить</button>
        </div>
        <div class="employees-table-wrapper">
          <div id="employeesResults">
            ${this.renderEmployeesResults(filterBlock)}
          </div>
        </div>
      </section>
      <div id="employeePreviewRoot"></div>
    `;

    this.attachOverviewPeriodListeners('employees', container, () => this.renderEmployeesPageWithTransition());
    this.bindEmployeesEvents(container);
  },
  bindEmployeesEvents(root = document) {
    root.querySelector('#employeeSearch')?.addEventListener('input', (event) => {
      this.state.filters.search = event.target.value;
      this.applyEmployeeFilters();
    });
    root.querySelector('#filterCenter')?.addEventListener('change', (event) => {
      this.state.filters.centerId = event.target.value;
      if (!this.isManagementAvailableForCenter(this.state.filters.managementId, this.state.filters.centerId)) {
        this.state.filters.managementId = '';
      }
      this.applyEmployeeFilters();
    });
    root.querySelector('#filterManagement')?.addEventListener('change', (event) => {
      this.state.filters.managementId = event.target.value;
      this.applyEmployeeFilters();
    });
    root.querySelector('#filterStatus')?.addEventListener('change', (event) => {
      this.state.filters.status = event.target.value;
      this.applyEmployeeFilters();
    });
    root.querySelector('#resetFilters')?.addEventListener('click', () => {
      this.state.filters = { search: '', centerId: '', managementId: '', status: '' };
      this.applyEmployeeFilters();
    });
    this.bindEmployeesTableEvents(root);
  },
  applyEmployeeFilters() {
    if (!this.isManagementAvailableForCenter(this.state.filters.managementId, this.state.filters.centerId)) {
      this.state.filters.managementId = '';
    }
    this.updateEmployeesResults();
  },
  updateEmployeesResults() {
    const root = document.getElementById('pageContent') || this.getCurrentViewLayer();
    if (!root) return;
    const activeElement = document.activeElement;
    const activeElementId = activeElement?.id || '';
    const selectionStart = typeof activeElement?.selectionStart === 'number' ? activeElement.selectionStart : null;
    const selectionEnd = typeof activeElement?.selectionEnd === 'number' ? activeElement.selectionEnd : null;
    const filtered = this.getFilteredEmployees();
    const searchInput = root.querySelector('#employeeSearch');
    if (searchInput && searchInput.value !== this.state.filters.search) {
      searchInput.value = this.state.filters.search || '';
    }
    const centerSelect = root.querySelector('#filterCenter');
    if (centerSelect) centerSelect.value = this.state.filters.centerId || '';
    const managementSelect = root.querySelector('#filterManagement');
    if (managementSelect) {
      managementSelect.innerHTML = this.populateManagementFilter();
      managementSelect.value = this.state.filters.managementId || '';
    }
    const statusSelect = root.querySelector('#filterStatus');
    if (statusSelect) statusSelect.value = this.state.filters.status || '';
    const results = root.querySelector('#employeesResults');
    if (results) {
      results.innerHTML = this.renderEmployeesResults(filtered);
      this.bindEmployeesTableEvents(results);
    }
    if (activeElementId) {
      const nextActiveElement = root.querySelector(`#${activeElementId}`);
      if (nextActiveElement && typeof nextActiveElement.focus === 'function') {
        nextActiveElement.focus();
        if (selectionStart !== null && typeof nextActiveElement.setSelectionRange === 'function') {
          nextActiveElement.setSelectionRange(selectionStart, selectionEnd ?? selectionStart);
        }
      }
    }
  },
  bindEmployeesTableEvents(root = document) {
    root.querySelectorAll('.employee-row').forEach((row) => {
      row.addEventListener('click', () => this.renderEmployeePreview(Number(row.dataset.employeeId), row));
    });
    root.querySelectorAll('.profile-button').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const employeeId = button.dataset.profileId;
        if (employeeId) {
          window.location.href = `employee.html?id=${encodeURIComponent(employeeId)}`;
        }
      });
    });
  },
  isManagementAvailableForCenter(managementId, centerId = this.state.filters.centerId) {
    if (!managementId) {
      return true;
    }
    const management = this.getManagementsList().find((item) => item.id === String(managementId));
    if (!management) {
      return false;
    }
    return !centerId || management.centerId === centerId;
  },
  getFilteredEmployees() {
    const employees = this.getNormalizedEmployees();
    const searchValue = String(this.state.filters.search || '').trim().toLowerCase();
    const centerId = String(this.state.filters.centerId || '');
    const managementId = String(this.state.filters.managementId || '');
    return employees.filter((employee) => {
      const fullName = String(employee.fullName || '').toLowerCase();
      const shortName = String(employee.shortName || '').toLowerCase();
      const centerName = String(employee.centerName || employee.center || '').toLowerCase();
      const managementName = String(employee.managementName || employee.management || '').toLowerCase();
      const matchesSearch = !searchValue || fullName.includes(searchValue) || shortName.includes(searchValue) || centerName.includes(searchValue) || managementName.includes(searchValue);
      const matchesCenter = !centerId || String(employee.centerId || '') === centerId;
      const matchesManagement = !managementId || String(employee.managementId || '') === managementId || employee.managementName === managementId;
      const matchesStatus = !this.state.filters.status || employee.status === this.state.filters.status;
      return matchesSearch && matchesCenter && matchesManagement && matchesStatus;
    });
  },
  renderEmployeesTable(filterBlock) {
    return `
      <table class="employees-table">
        <thead>
          <tr>
            <th>Сотрудник</th>
            <th>Должность</th>
            <th>Управление</th>
            <th>Загрузка</th>
            <th>Выполнено задач</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${filterBlock.map((employee) => `
            <tr class="employee-row ${Number(this.state.previewEmployeeId) === Number(employee.id) ? 'is-selected' : ''}" data-employee-id="${employee.id}">
              <td>
                <div class="employee-name-cell">
                  <strong>${this.escapeHtml(employee.fullName)}</strong>
                  <div class="card__subtitle">${this.escapeHtml(employee.centerName || employee.center || 'Без центра')}</div>
                </div>
              </td>
              <td>${this.escapeHtml(employee.position)}</td>
              <td>${this.escapeHtml(employee.managementName || employee.management || 'Без управления')}</td>
              <td>${this.renderPercentBadge(`${employee.loadPercent}%`, this.getLoadLevelClass(employee.loadPercent))}</td>
              <td>${employee.completedTasks}/${employee.tasksTotal}</td>
              <td>
                <button class="button button--subtle profile-button" data-profile-id="${employee.id}">Профиль</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },
  renderEmployeesResults(filterBlock = this.getFilteredEmployees()) {
    return filterBlock.length
      ? this.renderEmployeesTable(filterBlock)
      : `<div class="empty-state">Под выбранные фильтры сотрудников не найдено.</div>`;
  },
  populateCenterFilter() {
    const centers = this.getCentersList();
    const currentCenterId = String(this.state.filters.centerId || '');
    return `
      <option value="">Все центры</option>
      ${centers.map((center) => `<option value="${this.escapeHtml(center.id)}" ${currentCenterId === center.id ? 'selected' : ''}>${this.escapeHtml(center.name)}</option>`).join('')}
    `;
  },
  populateManagementFilter() {
    const centerId = String(this.state.filters.centerId || '');
    const currentManagementId = this.isManagementAvailableForCenter(this.state.filters.managementId, centerId)
      ? String(this.state.filters.managementId || '')
      : '';
    const managements = this.getManagementsList().filter((management) => !centerId || management.centerId === centerId);
    return `
      <option value="">Все управления</option>
      ${managements.map((management) => `<option value="${this.escapeHtml(management.id)}" ${currentManagementId === management.id ? 'selected' : ''}>${this.escapeHtml(management.name)}</option>`).join('')}
    `;
  },
  ensureFloatingPanelsRoot() {
    let root = document.getElementById('floatingPanelsRoot');
    if (!root) {
      root = document.createElement('div');
      root.id = 'floatingPanelsRoot';
      document.body.appendChild(root);
    }
    return root;
  },
  getFloatingPanelContainer(panelId) {
    return this.ensureFloatingPanelsRoot().querySelector(`[data-floating-panel-id="${panelId}"]`);
  },
  getFloatingPanelElement(panelId) {
    const container = this.getFloatingPanelContainer(panelId);
    if (!container) return null;
    return container.matches?.('.floating-panel, .task-modal, .employee-preview, .staff-employee-preview')
      ? container
      : container.querySelector('.floating-panel, .task-modal, .employee-preview, .staff-employee-preview');
  },
  openFloatingPanel(options = {}) {
    const {
      id,
      html,
      triggerElement = null,
      panelSelector = '.floating-panel',
      handleSelector = '.floating-panel__drag-handle',
      width = '',
      position = null,
      draggable = true,
      modalType = id,
      centerIfNoTrigger = false,
      margin = 8,
      gap = 8
    } = options;
    if (!id || !html) return null;
    const root = this.ensureFloatingPanelsRoot();
    this.closeFloatingPanel(id, { immediate: true });
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    const container = template.content.firstElementChild;
    if (!container) return null;
    container.dataset.floatingPanelId = id;
    root.appendChild(container);
    const panelElement = container.matches?.(panelSelector)
      ? container
      : container.querySelector(panelSelector) || container.querySelector('.floating-panel, .task-modal, .employee-preview, .staff-employee-preview') || container;
    panelElement.dataset.modalType = modalType || id;
    if (width) {
      panelElement.style.width = width;
    }
    this.positionFloatingPanel(triggerElement, panelElement, {
      position,
      panelId: modalType || id,
      centerIfNoTrigger,
      margin,
      gap
    });
    if (draggable) {
      this.makeDraggable(panelElement, panelElement.querySelector(handleSelector));
    }
    window.requestAnimationFrame(() => {
      container.classList.add('is-visible');
      panelElement.classList.add('is-visible');
    });
    return { container, panelElement };
  },
  closeFloatingPanel(panelId, options = {}) {
    const { immediate = false, callback = null } = options;
    const container = this.getFloatingPanelContainer(panelId);
    if (!container) {
      callback?.();
      return;
    }
    const finishClose = () => {
      container.remove();
      callback?.();
    };
    if (immediate) {
      finishClose();
      return;
    }
    this.closeFloatingPanelWithAnimation(container, finishClose);
  },
  positionFloatingPanel(triggerElement, panelElement, options = {}) {
    if (!panelElement) return;
    const margin = Number(options.margin ?? 8);
    const gap = Number(options.gap ?? 8);
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const panelWidth = panelElement.offsetWidth || panelElement.getBoundingClientRect().width;
    const panelHeight = panelElement.offsetHeight || panelElement.getBoundingClientRect().height;
    const savedPosition = !triggerElement && !options.position ? this.state.modalPositions?.[options.panelId] : null;
    const triggerRect = triggerElement?.getBoundingClientRect?.();
    let left = options.position?.left ?? savedPosition?.x ?? margin;
    let top = options.position?.top ?? savedPosition?.y ?? margin;

    if (triggerRect && !options.position) {
      left = triggerRect.left;
      top = triggerRect.bottom + gap;
      if (top + panelHeight > viewportHeight - margin) {
        top = triggerRect.top - panelHeight - gap;
      }
    } else if (!savedPosition && !options.position && options.centerIfNoTrigger) {
      left = (viewportWidth - panelWidth) / 2;
      top = (viewportHeight - panelHeight) / 2;
    }

    const maxLeft = Math.max(margin, viewportWidth - panelWidth - margin);
    const maxTop = Math.max(margin, viewportHeight - panelHeight - margin);
    left = Math.max(margin, Math.min(left, maxLeft));
    top = Math.max(margin, Math.min(top, maxTop));

    panelElement.style.position = 'fixed';
    panelElement.style.right = 'auto';
    panelElement.style.bottom = 'auto';
    panelElement.style.left = `${Math.round(left)}px`;
    panelElement.style.top = `${Math.round(top)}px`;
    panelElement.style.margin = '0';
  },
  renderEmployeePreview(employeeId, rowElement = null) {
    const employee = this.getNormalizedEmployees().find((item) => Number(item.id) === Number(employeeId));
    if (!employee) return;
    const existingPreview = this.getFloatingPanelElement('employee-preview');
    const preservedPosition = !rowElement && existingPreview ? existingPreview.getBoundingClientRect() : null;
    this.state.previewEmployeeId = employeeId;
    const filtered = this.getFilteredEmployees();
    const currentIndex = filtered.findIndex((item) => item.id === employeeId);
    const previewPeriodSettings = this.getOverviewPeriodSettings('employeePreview');
    const previewPeriodRange = { startDate: previewPeriodSettings.startDate, endDate: previewPeriodSettings.endDate };
    const previewTasks = this.getTasksForEmployees([employee], previewPeriodRange);
    const previewAverageLoad = this.getAverageLoadForRange(employee, previewPeriodRange.startDate, previewPeriodRange.endDate);
    const previewMetrics = this.getEmployeeCoreMetrics([employee], previewTasks, previewPeriodRange, previewAverageLoad);
    document.querySelectorAll('.employee-row.is-selected').forEach((row) => row.classList.remove('is-selected'));
    document.querySelector(`.employee-row[data-employee-id="${employee.id}"]`)?.classList.add('is-selected');
    const html = `
      <section class="employee-preview employee-preview--floating floating-panel" role="dialog" aria-modal="false" aria-labelledby="employeePreviewTitle">
        <div class="employee-preview__head employee-preview__header employee-preview__drag-handle floating-panel__header floating-panel__drag-handle">
          <div>
            <h3 class="section-title" id="employeePreviewTitle">${this.escapeHtml(employee.fullName)}</h3>
          </div>
          <button class="employee-preview__close floating-panel__close" id="closePreview" type="button" aria-label="Закрыть">
            <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
            </svg>
          </button>
        </div>
        <div class="employee-preview__body floating-panel__body">
          <div class="detail-list">
            <div class="preview-info-row"><span class="preview-info-row__value">${this.escapeHtml(employee.centerName || employee.center)}</span><span class="preview-info-row__label">Центр</span></div>
            <div class="preview-info-row"><span class="preview-info-row__value">${this.escapeHtml(employee.managementName || employee.management)}</span><span class="preview-info-row__label">Управление</span></div>
            <div class="preview-info-row"><span class="preview-info-row__value">${this.escapeHtml(employee.department)}</span><span class="preview-info-row__label">Отдел</span></div>
            <div class="preview-info-row"><span class="preview-info-row__value">${this.escapeHtml(employee.position)}</span><span class="preview-info-row__label">Должность</span></div>
          </div>
          ${this.renderOverviewPeriodBar('employeePreview')}
          <div class="preview-metric-grid">
            ${previewMetrics.map((metric) => this.renderPreviewMetricCard(metric, this.getComparisonCaption(previewPeriodSettings.periodPreset))).join('')}
          </div>
          <div class="preview-actions preview-actions--compact">
            <a class="button button--primary button--sm" href="employee.html?id=${employee.id}">Подробнее</a>
            <button class="button button--ghost button--sm" id="nextPreview">Следующий</button>
          </div>
          <div class="card__subtitle">${currentIndex >= 0 ? `Следующий сотрудник из текущего списка (${currentIndex + 1}/${filtered.length})` : 'Текущий отфильтрованный список'}</div>
        </div>
      </section>
    `;
    const opened = this.openFloatingPanel({
      id: 'employee-preview',
      html,
      triggerElement: rowElement || document.querySelector(`.employee-row[data-employee-id="${employee.id}"]`),
      panelSelector: '.employee-preview',
      handleSelector: '.employee-preview__drag-handle',
      width: 'min(650px, calc(100vw - 32px))',
      position: preservedPosition,
      modalType: 'employeePreview',
      draggable: true,
      margin: 16,
      gap: 8
    });
    const preview = opened?.panelElement;
    if (preview) {
      this.attachOverviewPeriodListeners('employeePreview', preview, () => this.renderEmployeePreview(employeeId));
    }
    preview?.querySelector('#closePreview')?.addEventListener('click', (event) => {
      event.stopPropagation();
      this.closeEmployeePreview();
    });
    preview?.querySelector('#nextPreview')?.addEventListener('click', (event) => {
      event.stopPropagation();
      this.showNextEmployeePreview();
    });
    preview?.querySelector('.preview-actions a')?.addEventListener('click', (event) => {
      event.stopPropagation();
    });
  },
  positionEmployeePreview(rowElement) {
    const preview = this.getFloatingPanelElement('employee-preview') || document.querySelector('#employeePreviewRoot .employee-preview');
    if (!preview) return;
    this.positionFloatingPanel(rowElement, preview, { panelId: 'employeePreview', margin: 16, gap: 8 });
  },
  makeDraggable(modalElement, handleElement) {
    if (!modalElement || !handleElement || handleElement.dataset.dragBound === 'true') return;
    handleElement.dataset.dragBound = 'true';
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;
    const interactiveSelector = 'button, a, input, select, textarea, label, [role="button"], [contenteditable="true"], .preview-metric-card, .preview-kpi-card, .detail-item, .preview-info-row';

    const onPointerMove = (event) => {
      if (!isDragging) return;
      const margin = 8;
      const currentWidth = modalElement.offsetWidth;
      const currentHeight = modalElement.offsetHeight;
      const minX = margin;
      const minY = margin;
      const maxX = Math.max(minX, window.innerWidth - currentWidth - margin);
      const maxY = Math.max(minY, window.innerHeight - currentHeight - margin);
      const nextLeft = Math.max(minX, Math.min(event.clientX - offsetX, maxX));
      const nextTop = Math.max(minY, Math.min(event.clientY - offsetY, maxY));
      modalElement.style.right = 'auto';
      modalElement.style.bottom = 'auto';
      modalElement.style.left = `${Math.round(nextLeft)}px`;
      modalElement.style.top = `${Math.round(nextTop)}px`;
    };

    const onPointerUp = (event) => {
      if (!isDragging) return;
      isDragging = false;
      const type = modalElement.dataset.modalType || (modalElement.classList.contains('employee-preview') ? 'employeePreview' : modalElement.classList.contains('staff-employee-preview') ? 'staffEmployeePreview' : modalElement.classList.contains('task-modal') ? 'taskModal' : 'modal');
      const nextRect = modalElement.getBoundingClientRect();
      this.saveModalPosition(type, nextRect.left, nextRect.top);
      modalElement.classList.remove('is-dragging');
      document.body.classList.remove('is-modal-dragging', 'is-dragging-modal');
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      if (handleElement.hasPointerCapture?.(event.pointerId)) {
        handleElement.releasePointerCapture?.(event.pointerId);
      }
    };

    handleElement.addEventListener('pointerdown', (event) => {
      if (isDragging || event.button !== 0 || event.target.closest?.(interactiveSelector)) return;
      const modalRect = modalElement.getBoundingClientRect();
      const modalWidth = modalRect.width;
      offsetX = event.clientX - modalRect.left;
      offsetY = event.clientY - modalRect.top;
      isDragging = true;
      modalElement.style.position = 'fixed';
      modalElement.style.left = `${Math.round(modalRect.left)}px`;
      modalElement.style.top = `${Math.round(modalRect.top)}px`;
      modalElement.style.right = 'auto';
      modalElement.style.bottom = 'auto';
      modalElement.style.margin = '0';
      modalElement.style.width = `${Math.round(modalWidth)}px`;
      modalElement.style.transform = 'none';
      modalElement.classList.add('is-dragging');
      document.body.classList.add('is-modal-dragging', 'is-dragging-modal');
      handleElement.setPointerCapture?.(event.pointerId);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
      event.preventDefault();
    });
  },
  saveModalPosition(type, x, y) {
    this.state.modalPositions = this.state.modalPositions || {};
    this.state.modalPositions[type] = { x: Math.round(x), y: Math.round(y) };
  },
  closeEmployeePreview(options = {}) {
    const { immediate = false } = options;
    const legacyPreviewRoot = document.getElementById('employeePreviewRoot');
    const finishClose = () => {
      if (legacyPreviewRoot) {
        legacyPreviewRoot.innerHTML = '';
      }
      document.querySelectorAll('.employee-row.is-selected').forEach((row) => row.classList.remove('is-selected'));
      this.state.previewEmployeeId = null;
    };
    if (this.getFloatingPanelContainer('employee-preview')) {
      this.closeFloatingPanel('employee-preview', { immediate, callback: finishClose });
      return;
    }
    const legacyPreview = legacyPreviewRoot?.querySelector('.employee-preview');
    if (legacyPreview) {
      if (immediate) {
        legacyPreview.remove();
        finishClose();
        return;
      }
      this.closeModalWithAnimation(legacyPreview, finishClose);
      return;
    }
    finishClose();
  },
  closeModalWithAnimation(modalElement, callback) {
    if (!modalElement || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      callback?.();
      return;
    }
    modalElement.classList.remove('is-visible');
    modalElement.classList.add('is-closing');
    window.setTimeout(() => callback?.(), 220);
  },
  revealInteractiveOverlays() {
    window.requestAnimationFrame(() => {
      document.querySelectorAll('.modal-backdrop, .task-modal, .employee-preview, .staff-employee-preview').forEach((element) => {
        element.classList.add('is-visible');
        if (element.classList.contains('task-modal')) {
          this.makeDraggable(element, element.querySelector('.task-modal__header'));
        }
        if (element.classList.contains('employee-preview') || element.classList.contains('staff-employee-preview')) {
          this.makeDraggable(element, element.querySelector('.employee-preview__head'));
        }
      });
    });
  },
  showNextEmployeePreview() {
    const filtered = this.getFilteredEmployees();
    if (!filtered.length) return;
    const currentIndex = filtered.findIndex((employee) => employee.id === this.state.previewEmployeeId);
    const nextEmployee = filtered[(currentIndex + 1) % filtered.length];
    this.renderEmployeePreview(nextEmployee.id);
  },
  openTaskModal(taskId, triggerElement = null) {
    this.closeTaskModal({ immediate: true, resetState: false });
    this.state.selectedTaskId = Number(taskId);
    this.state.showTaskModal = true;
    this.state.showOnlyActiveParticipants = true;
    this.renderTaskModalIntoPage(triggerElement);
  },
  closeTaskModal(options = {}) {
    const { immediate = false, resetState = true } = options;
    const finishClose = () => {
      if (resetState) {
        this.state.selectedTaskId = null;
        this.state.showTaskModal = false;
      }
      document.querySelector('[data-modal-backdrop="task"]')?.remove();
    };
    if (this.getFloatingPanelContainer('task-subtasks-modal')) {
      this.closeFloatingPanel('task-subtasks-modal', { immediate, callback: finishClose });
      return;
    }
    const backdrop = document.querySelector('[data-modal-backdrop="task"]');
    if (immediate) {
      finishClose();
      return;
    }
    if (backdrop) {
      this.closeFloatingPanelWithAnimation(backdrop, finishClose);
      return;
    }
    finishClose();
  },
  closeFloatingPanelWithAnimation(panelElement, callback) {
    if (!panelElement || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      callback?.();
      return;
    }
    const floatingPanel = panelElement.matches?.('.floating-panel, .task-modal, .employee-preview, .staff-employee-preview')
      ? panelElement
      : panelElement.querySelector('.floating-panel, .task-modal, .employee-preview, .staff-employee-preview');
    panelElement.classList.remove('is-visible');
    panelElement.classList.add('is-closing');
    floatingPanel?.classList.remove('is-visible');
    floatingPanel?.classList.add('is-closing');
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      floatingPanel?.removeEventListener('transitionend', finish);
      callback?.();
    };
    floatingPanel?.addEventListener('transitionend', finish, { once: true });
    window.setTimeout(finish, 260);
  },
  renderTaskModalIntoPage(triggerElement = null, position = null) {
    const container = this.getCurrentViewLayer();
    if (!container || this.state.currentPage !== 'employee') return;
    this.closeFloatingPanel('task-subtasks-modal', { immediate: true });
    document.querySelector('[data-modal-backdrop="task"]')?.remove();
    if (!this.state.showTaskModal) return;
    const opened = this.openFloatingPanel({
      id: 'task-subtasks-modal',
      html: this.renderTaskModal(this.state.selectedTaskId),
      triggerElement,
      panelSelector: '.task-subtasks-modal',
      handleSelector: '.task-modal__header',
      width: position?.width ? `${Math.round(position.width)}px` : 'min(1180px, calc(100vw - 32px))',
      position,
      modalType: 'taskModal',
      draggable: true,
      centerIfNoTrigger: true,
      margin: 8,
      gap: 8
    });
    this.bindTaskModalEvents(opened?.container || container);
  },
  bindTaskModalEvents(root = document) {
    const backdrop = root.matches?.('[data-modal-backdrop="task"]') ? root : root.querySelector('[data-modal-backdrop="task"]');
    const modal = backdrop?.querySelector('.task-modal');
    if (modal) {
      modal.dataset.modalType = 'taskModal';
      this.makeDraggable(modal, modal.querySelector('.task-modal__header'));
    }
    backdrop?.querySelector('#taskModalClose')?.addEventListener('click', () => this.closeTaskModal());
    backdrop?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) {
        this.closeTaskModal();
      }
    });
    backdrop?.querySelector('#taskModalActiveToggle')?.addEventListener('change', (event) => {
      this.state.showOnlyActiveParticipants = event.target.checked;
      const modalRect = modal?.getBoundingClientRect();
      this.renderTaskModalIntoPage(null, modalRect ? {
        left: modalRect.left,
        top: modalRect.top,
        width: modalRect.width
      } : null);
    });
  },
  getTaskSubtasks(taskId) {
    const numericTaskId = Number(taskId);
    const task = (this.mockData.tasks || []).find((item) => Number(item.id) === numericTaskId);
    const subtasks = this.mockData.subtasks || [];
    const taskSubtasks = subtasks.filter((subtask) => Number(subtask.taskId) === numericTaskId);
    if (taskSubtasks.length) {
      return taskSubtasks;
    }
    if (Array.isArray(task?.subtasks)) {
      return task.subtasks
        .map((subtask) => {
          if (subtask && typeof subtask === 'object') {
            return subtask;
          }
          return subtasks.find((item) => Number(item.id) === Number(subtask));
        })
        .filter(Boolean);
    }
    return [];
  },
  getTaskParticipants(subtask, onlyActive = this.state.showOnlyActiveParticipants) {
    const participants = subtask?.participants;
    if (Array.isArray(participants)) {
      return participants;
    }
    if (participants && typeof participants === 'object') {
      const active = Array.isArray(participants.active) ? participants.active : [];
      const all = Array.isArray(participants.all) ? participants.all : active;
      return onlyActive ? active : all;
    }
    if (typeof participants === 'string' && participants.trim()) {
      return [participants.trim()];
    }
    return [];
  },
  getParticipantName(participant) {
    if (participant === null || participant === undefined) return '';
    if (typeof participant === 'string' || typeof participant === 'number') return String(participant).trim();
    if (typeof participant === 'object') {
      return String(participant.name || participant.fullName || participant.shortName || participant.label || '').trim();
    }
    return '';
  },
  normalizeParticipantName(value) {
    return String(value || '')
      .trim()
      .toLocaleLowerCase('ru-RU')
      .replace(/ё/g, 'е')
      .replace(/\s+/g, ' ');
  },
  getEmployeeInitialName(employee) {
    const parts = String(employee?.fullName || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length < 2) return '';
    return `${parts[1].charAt(0)}. ${parts[0]}`;
  },
  findEmployeeByParticipantName(participant) {
    const employees = this.getNormalizedEmployees ? this.getNormalizedEmployees() : (this.mockData.employees || []);
    if (!participant) return null;
    if (typeof participant === 'object') {
      const participantEmployeeId = participant.participantEmployeeId || participant.employeeId || participant.employeeID;
      if (participantEmployeeId !== undefined && participantEmployeeId !== null) {
        const byId = employees.find((employee) => String(employee.id) === String(participantEmployeeId));
        if (byId) return byId;
      }
    }
    const participantName = this.getParticipantName(participant);
    const normalizedName = this.normalizeParticipantName(participantName);
    const compactName = normalizedName.replace(/[.\s]/g, '');
    if (!normalizedName) return null;
    return employees.find((employee) => {
      const candidates = [
        employee.fullName,
        employee.shortName,
        this.getEmployeeInitialName(employee)
      ].filter(Boolean);
      return candidates.some((candidate) => {
        const normalizedCandidate = this.normalizeParticipantName(candidate);
        return normalizedCandidate === normalizedName || normalizedCandidate.replace(/[.\s]/g, '') === compactName;
      });
    }) || null;
  },
  renderParticipantLink(participant) {
    const employee = this.findEmployeeByParticipantName(participant);
    const participantName = this.getParticipantName(participant) || employee?.shortName || employee?.fullName || '';
    if (!participantName) {
      return '<span class="participant-name">—</span>';
    }
    if (!employee) {
      return `<span class="participant-name">${this.escapeHtml(participantName)}</span>`;
    }
    return `<a class="participant-link" href="employee.html?id=${encodeURIComponent(employee.id)}">${this.escapeHtml(participantName)}</a>`;
  },
  renderTaskModal(taskId) {
    const task = (this.mockData.tasks || []).find((item) => Number(item.id) === Number(taskId));
    if (!task) {
      return '';
    }
    const subtasks = this.getTaskSubtasks(task.id);
    const onlyActive = Boolean(this.state.showOnlyActiveParticipants);
    const taskParticipants = this.getTaskParticipants(task, onlyActive);
    return `
      <div class="modal-backdrop modal-backdrop--floating" data-modal-backdrop="task">
        <section class="task-modal task-subtasks-modal floating-panel" data-modal-type="taskModal" role="dialog" aria-modal="true" aria-labelledby="taskModalTitle">
          <div class="task-modal__header floating-panel__header floating-panel__drag-handle">
            <div>
              <h3 id="taskModalTitle">Работы по задаче: ${this.escapeHtml(task.taskName)}</h3>
              <div class="task-modal__meta">
                <span>${this.escapeHtml(task.project || 'Без проекта')}</span>
                <span class="status-pill task-status ${this.getStatusClass(task.status)}">${this.escapeHtml(task.status)}</span>
                <span class="status-pill task-indicator ${this.getStatusClass(task.indicator)}">${this.escapeHtml(task.indicator)}</span>
              </div>
            </div>
            <button class="task-modal__close floating-panel__close" id="taskModalClose" type="button" aria-label="Закрыть">
              <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
              </svg>
            </button>
          </div>
          <div class="task-modal__body floating-panel__body">
            <label class="toggle task-modal__toggle">
              <input type="checkbox" id="taskModalActiveToggle" ${onlyActive ? 'checked' : ''}>
              Только активные участники
            </label>
            ${taskParticipants.length ? `
              <div class="task-modal__participants">
                <span class="task-modal__participants-label">Участники задачи</span>
                <div class="participant-list">
                  ${taskParticipants.map((participant) => this.renderParticipantLink(participant)).join('')}
                </div>
              </div>
            ` : ''}
            <div class="task-modal__table-wrap">
              <table class="task-modal__table">
                <thead>
                  <tr>
                    <th class="name-cell">Название подзадачи</th>
                    <th class="work-type-cell">Вид работы</th>
                    <th class="detail-cell">Название детали</th>
                    <th class="date-cell">Срок выполнения подзадачи</th>
                    <th class="hours-cell">Время выполнения, часов</th>
                    <th class="status-cell">Статус задачи</th>
                    <th class="indicator-cell">Индикатор</th>
                    <th class="participants-cell">Участники подзадачи</th>
                  </tr>
                </thead>
                <tbody>
                  ${subtasks.length ? subtasks.map((subtask) => {
                    const participants = this.getTaskParticipants(subtask, onlyActive);
                    return `
                      <tr>
                        <td class="name-cell">${this.escapeHtml(subtask.subtaskName || subtask.taskName || 'Без названия')}</td>
                        <td class="work-type-cell">${this.escapeHtml(subtask.workType || '—')}</td>
                        <td class="detail-cell">${this.escapeHtml(subtask.detailName || subtask.assignedDetails || '—')}</td>
                        <td class="date-cell">${this.escapeHtml(subtask.dueDate || '—')}</td>
                        <td class="hours-cell">${this.escapeHtml(this.formatHours(this.parseWorkHours(subtask.workTime)))}</td>
                        <td class="status-cell"><span class="status-pill task-status ${this.getStatusClass(subtask.status)}">${this.escapeHtml(subtask.status || '—')}</span></td>
                        <td class="indicator-cell"><span class="status-pill task-indicator ${this.getStatusClass(subtask.indicator)}">${this.escapeHtml(subtask.indicator || '—')}</span></td>
                        <td class="participants-cell">
                          <div class="participant-list">
                            ${participants.length ? participants.map((participant) => this.renderParticipantLink(participant)).join('') : '<span class="participant-name">—</span>'}
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('') : `
                    <tr>
                      <td colspan="8" class="task-modal__empty">По задаче пока нет подзадач.</td>
                    </tr>
                  `}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    `;
  },
  renderEmployeePage(container, options = {}) {
    const employeeId = Number(new URLSearchParams(window.location.search).get('id')) || 1;
    const employee = this.getNormalizedEmployees().find((item) => Number(item.id) === employeeId);
    if (!employee) {
      container.innerHTML = `
        <div class="page-back"><a href="employees.html">← Сотрудники</a></div>
        <section class="card">
          <h3>Сотрудник не найден</h3>
          <p class="card__subtitle">Проверьте ссылку или выберите сотрудника из списка.</p>
        </section>
      `;
      return;
    }

    if (!options.preserveExistingCharts) {
      StaffCharts.destroyAll();
    }
    this.state.activeEmployee = employee;
    const periodButtons = [
      { key: 'week', label: 'Неделя' },
      { key: 'month', label: 'Месяц' },
      { key: 'quarter', label: 'Квартал' },
      { key: 'year', label: 'Год' },
      { key: 'custom', label: 'Свой период' }
    ];
    const periodMeta = this.getEmployeePeriodMeta();
    this.state.employeeStartDate = this.state.employeeStartDate || periodMeta.startDate;
    this.state.employeeEndDate = this.state.employeeEndDate || periodMeta.endDate;
    const employeePeriodRange = { startDate: this.state.employeeStartDate, endDate: this.state.employeeEndDate };
    const tasks = this.getTasksForEmployees([employee], employeePeriodRange);
    const employeePeriodAverageLoad = this.getAverageLoadForRange(employee, employeePeriodRange.startDate, employeePeriodRange.endDate);
    const employeeMetrics = this.getEmployeeCoreMetrics([employee], tasks, employeePeriodRange, employeePeriodAverageLoad);
    const dateDisabled = this.state.employeePeriod !== 'custom';
    const employeeDynamicSettings = this.getDynamicSettings('employee');
    const employeeHistoryData = this.getDynamicChartData(
      employee,
      employeeDynamicSettings.startDate,
      employeeDynamicSettings.endDate,
      employeeDynamicSettings.granularity
    );
    const employeeHistoryValues = employeeHistoryData.values.length
      ? employeeHistoryData.values
      : this.getDynamicValues(employee, employeeDynamicSettings.granularity);
    const employeeHistoryAverage = employeeHistoryValues.length
      ? Math.round(employeeHistoryValues.reduce((sum, value) => sum + value, 0) / employeeHistoryValues.length)
      : null;
    const taskDistributionItems = Object.entries(employee.taskDistribution || {}).map(([label, value]) => ({ label, value }));
    const taskDistributionTotal = taskDistributionItems.reduce((sum, item) => sum + Number(item.value || 0), 0) || employee.tasksTotal || 0;
    const planFactSubtitle = this.formatEmployeePlanFactSubtitle();

    container.innerHTML = `
      <section class="employee-profile-card">
        <a class="page-back" href="employees.html">← Сотрудники</a>
        <div class="employee-profile-card__main">
          <h2 class="section-title">${this.escapeHtml(employee.fullName)}</h2>
          <p class="section-subtitle">${this.escapeHtml(employee.centerName || employee.center)} • ${this.escapeHtml(employee.managementName || employee.management)} • ${this.escapeHtml(employee.department)} • ${this.escapeHtml(employee.position)}</p>
        </div>
        <span class="badge badge--accent">${this.escapeHtml(employee.status)}</span>
      </section>
      <section class="card employee-period-card">
        <div class="wide-card__head">
          <div>
            <h3>Отчётный период</h3>
            <p class="card__subtitle">Сравнение загрузки по выбранному диапазону</p>
          </div>
          <div class="period-switcher">
            ${periodButtons.map((button) => `<button class="period-btn ${this.state.employeePeriod === button.key ? 'is-active' : ''}" data-period="${button.key}">${this.escapeHtml(button.label)}</button>`).join('')}
          </div>
          ${this.renderEmployeePeriodUnitSelector()}
        </div>
        <div class="date-row">
          <div class="field field--date">
            <label for="employeeStartDate">Дата начала</label>
            <input id="employeeStartDate" class="date-fit" type="date" value="${this.state.employeeStartDate}" ${dateDisabled ? 'disabled' : ''}>
          </div>
          <div class="field field--date">
            <label for="employeeEndDate">Дата окончания</label>
            <input id="employeeEndDate" class="date-fit" type="date" value="${this.state.employeeEndDate}" ${dateDisabled ? 'disabled' : ''}>
          </div>
          <div class="field" style="flex:1; display:flex; flex-direction:column; justify-content:flex-end;">
            <span class="card__subtitle">${this.escapeHtml(periodMeta.label)}</span>
          </div>
        </div>
        ${this.renderEmployeeMetricsPanel(employeeMetrics)}
      </section>
      <section class="employee-charts-grid">
        <article class="card employee-chart-card data-viz-card data-viz-card--wide">
          <div class="data-viz-card__header">
            <div>
              <h3 class="data-viz-card__title">План / факт времени</h3>
              <p class="data-viz-card__subtitle">${this.escapeHtml(planFactSubtitle)}</p>
            </div>
            ${this.renderDataVizMetric(this.formatHours(employee.actualHours), 'факт за период')}
          </div>
          <div class="data-viz-card__body chart-frame chart-frame--bar">
            <div class="chart-wrap employee-chart-wrap chart-wide-horizontal"><canvas id="barChart"></canvas></div>
          </div>
          <div class="data-viz-card__footer">
            ${this.renderBarChartFooter()}
          </div>
        </article>
        <article class="card employee-chart-card data-viz-card">
          <div class="data-viz-card__header">
            <div>
              <h3 class="data-viz-card__title">Распределение задач</h3>
              <p class="data-viz-card__subtitle">По статусам и типам</p>
            </div>
            ${this.renderDataVizMetric(`${taskDistributionTotal}`, 'задачи')}
          </div>
          <div class="data-viz-card__body donut-layout">
            <div class="donut-layout__chart chart-frame chart-frame--donut">
              <canvas id="donutChart"></canvas>
              ${this.renderDonutCenter(`${taskDistributionTotal}`, 'задачи')}
            </div>
            <div class="donut-layout__legend">
              ${this.renderChartLegend(taskDistributionItems, { suffix: '', maxItems: 5 })}
            </div>
          </div>
        </article>
      </section>
      <section class="table-card employee-load-card">
        <div class="table-card__head">
          <h3>Загрузка</h3>
          <div class="toggle-row">
            <label class="toggle"><input type="checkbox" id="showProjectsToggle" ${this.state.showProjects ? 'checked' : ''}> Показать проект</label>
          </div>
        </div>
        <div class="employee-load-table-wrap">
          <table class="employee-load-table">
            <thead>
              <tr>
                ${this.state.showProjects ? '<th>Проект</th>' : ''}
                <th>Название задачи</th>
                <th>Вид работы</th>
                <th>Срок выполнения задачи</th>
                <th>Время выполнения работы, часов</th>
                <th>Статус задачи</th>
                <th>Индикатор</th>
              </tr>
            </thead>
            <tbody>
              ${tasks.map((task) => {
                return `
                  <tr class="task-row" data-task-id="${task.id}">
                    ${this.state.showProjects ? `<td>${this.escapeHtml(task.project)}</td>` : ''}
                    <td>
                      <button class="employee-load-table__task-link" type="button" data-task-id="${task.id}">
                        ${this.escapeHtml(task.taskName)}
                      </button>
                    </td>
                    <td>${this.escapeHtml(task.workType)}</td>
                    <td>${this.escapeHtml(task.dueDate)}</td>
                    <td>${this.escapeHtml(this.formatHours(this.parseWorkHours(task.workTime)))}</td>
                    <td><span class="status-pill ${this.getStatusClass(task.status)}">${this.escapeHtml(task.status)}</span></td>
                    <td><span class="status-pill ${this.getStatusClass(task.indicator)}">${this.escapeHtml(task.indicator)}</span></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </section>
      <section class="wide-card employee-dynamic-card data-viz-card data-viz-card--wide">
        <div class="data-viz-card__header">
          <div>
            <h3 class="data-viz-card__title">Динамика загруженности сотрудника</h3>
            <p class="data-viz-card__subtitle" id="employeeHistorySubtitle">${this.escapeHtml(this.formatDynamicSubtitle(employeeDynamicSettings))}</p>
          </div>
          ${this.renderDataVizMetric(employeeHistoryAverage !== null ? `${employeeHistoryAverage}%` : '—', this.getAveragePeriodLabel(employeeDynamicSettings), 'employeeHistoryAverage')}
        </div>
        ${this.renderDynamicControls('employee')}
        <div class="data-viz-card__body chart-frame chart-frame--wide">
          <div class="chart-large employee-history-chart"><canvas id="historyChart"></canvas></div>
        </div>
      </section>
    `;

    this.updateEmployeeCharts(employee, container);
    this.revealInteractiveOverlays();
      this.initSwitchIndicators(container);
      container.querySelectorAll('.period-btn').forEach((button) => {
        button.addEventListener('click', () => {
          this.state.employeePeriod = button.dataset.period;
          if (button.dataset.period === 'custom') {
            this.state.employeeStartDate = this.state.employeeStartDate || periodMeta.startDate;
            this.state.employeeEndDate = this.state.employeeEndDate || periodMeta.endDate;
          } else {
            const nextMeta = this.getEmployeePeriodMeta(button.dataset.period);
            this.state.employeeStartDate = nextMeta.startDate;
            this.state.employeeEndDate = nextMeta.endDate;
          }
          this.renderEmployeePageWithTransition();
        });
      });
      container.querySelector('#employeePeriodMonthSelect')?.addEventListener('change', (event) => {
        this.state.employeePeriodMonth = Number(event.target.value);
        const nextMeta = this.getEmployeePeriodMeta('month');
        this.state.employeeStartDate = nextMeta.startDate;
        this.state.employeeEndDate = nextMeta.endDate;
        this.renderEmployeePageWithTransition();
      });
      container.querySelector('#employeePeriodQuarterSelect')?.addEventListener('change', (event) => {
        this.state.employeePeriodQuarter = Number(event.target.value);
        const nextMeta = this.getEmployeePeriodMeta('quarter');
        this.state.employeeStartDate = nextMeta.startDate;
        this.state.employeeEndDate = nextMeta.endDate;
        this.renderEmployeePageWithTransition();
      });
      container.querySelectorAll('.employee-load-table__task-link').forEach((button) => {
        button.addEventListener('click', (event) => {
          event.stopPropagation();
          this.openTaskModal(Number(button.dataset.taskId), button.closest('tr') || button);
        });
      });
      this.attachDynamicControlsListeners('employee', container, employee, 'historyChart');
      container.querySelector('#showProjectsToggle')?.addEventListener('change', (event) => {
        this.state.showProjects = event.target.checked;
        this.renderEmployeePageWithTransition();
      });
      this.bindTaskModalEvents(container);
      container.querySelector('#employeeStartDate')?.addEventListener('change', (event) => {
        this.state.employeeStartDate = event.target.value;
        this.renderEmployeePageWithTransition();
      });
      container.querySelector('#employeeEndDate')?.addEventListener('change', (event) => {
        this.state.employeeEndDate = event.target.value;
        this.renderEmployeePageWithTransition();
      });
  },
  renderEmployeePageWithTransition() {
    this.closeTaskModal({ immediate: true });
    this.closeEmployeePreview({ immediate: true });
    return this.renderWithTransition(
      (targetLayer, transitionState) => {
        this.renderEmployeePage(targetLayer, { preserveExistingCharts: !transitionState.direct });
      },
      {
        beforeDirectRender: () => StaffCharts.destroyAll(),
        afterCommit: (currentLayer) => this.initSwitchIndicators(currentLayer)
      }
    );
  },
  getEmployeePeriodMeta(periodKey = this.state.employeePeriod) {
    const today = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    const format = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    if (periodKey === 'month') {
      const monthIndex = Number.isInteger(this.state.employeePeriodMonth) ? this.state.employeePeriodMonth : today.getMonth();
      const startDate = new Date(today.getFullYear(), monthIndex, 1);
      const endDate = new Date(today.getFullYear(), monthIndex + 1, 0);
      return {
        startDate: format(startDate),
        endDate: format(endDate),
        label: `${startDate.getDate()} ${this.getMonthName(startDate.getMonth())} – ${endDate.getDate()} ${this.getMonthName(endDate.getMonth())}`,
        rangeLabel: 'Месяц'
      };
    }
    if (periodKey === 'quarter') {
      const quarterIndex = Number.isInteger(this.state.employeePeriodQuarter) ? this.state.employeePeriodQuarter : Math.floor(today.getMonth() / 3);
      const startDate = new Date(today.getFullYear(), quarterIndex * 3, 1);
      const endDate = new Date(today.getFullYear(), quarterIndex * 3 + 3, 0);
      return {
        startDate: format(startDate),
        endDate: format(endDate),
        label: `${this.getQuarterLabel(quarterIndex)} ${today.getFullYear()}`,
        rangeLabel: 'Квартал'
      };
    }
    if (periodKey === 'year') {
      const startDate = new Date(today.getFullYear(), 0, 1);
      const endDate = new Date(today.getFullYear(), 11, 31);
      return {
        startDate: format(startDate),
        endDate: format(endDate),
        label: `${today.getFullYear()} год`,
        rangeLabel: 'Год'
      };
    }
    if (periodKey === 'custom') {
      return {
        startDate: this.state.employeeStartDate || format(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7)),
        endDate: this.state.employeeEndDate || format(today),
        label: 'Пользовательский период',
        rangeLabel: 'Свой период'
      };
    }
    const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
    const endDate = today;
    return {
      startDate: format(startDate),
      endDate: format(endDate),
      label: `${this.getDayName(startDate.getDay())} — ${this.getDayName(endDate.getDay())}`,
      rangeLabel: 'Неделя'
    };
  },
  getMonthName(monthIndex) {
    return ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'][monthIndex] || '';
  },
  renderEmployeePeriodUnitSelector() {
    const period = this.state.employeePeriod;
    if (period === 'month') {
      const index = Number.isInteger(this.state.employeePeriodMonth) ? this.state.employeePeriodMonth : new Date().getMonth();
      return `
        <select class="period-unit-select" id="employeePeriodMonthSelect">
          ${this.getPeriodUnitOptionsMarkup('month', index)}
        </select>
      `;
    }
    if (period === 'quarter') {
      const index = Number.isInteger(this.state.employeePeriodQuarter) ? this.state.employeePeriodQuarter : Math.floor(new Date().getMonth() / 3);
      return `
        <select class="period-unit-select" id="employeePeriodQuarterSelect">
          ${this.getPeriodUnitOptionsMarkup('quarter', index)}
        </select>
      `;
    }
    if (period === 'year') {
      return `
        <select class="period-unit-select" id="employeePeriodYearSelect">
          ${this.getPeriodUnitOptionsMarkup('year', 0)}
        </select>
      `;
    }
    return '';
  },
  getDayName(dayIndex) {
    return ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][dayIndex] || '';
  },
  updateEmployeeCharts(employee, root = document) {
    const barCanvas = root.querySelector?.('#barChart') || document.getElementById('barChart');
    if (barCanvas) {
      const planned = [0.22, 0.26, 0.25, 0.27].map((part) => Math.round(employee.plannedHours * part));
      const actual = [0.2, 0.24, 0.27, 0.29].map((part) => Math.round(employee.actualHours * part));
      StaffCharts.createBar(barCanvas, ['Неделя 1', 'Неделя 2', 'Неделя 3', 'Неделя 4'], planned, actual);
    }
    const donutCanvas = root.querySelector?.('#donutChart') || document.getElementById('donutChart');
    if (donutCanvas) {
      const labels = Object.keys(employee.taskDistribution || {});
      const values = Object.values(employee.taskDistribution || {});
      const colors = this.getChartPaletteSequence();
      StaffCharts.createDoughnut(donutCanvas, labels, values, colors);
    }
    const historyCanvas = root.querySelector?.('#historyChart') || document.getElementById('historyChart');
    if (historyCanvas) {
      this.updateDynamicChart('employee', 'historyChart', employee, root);
    }
  },
  updateEmployeeHistoryChart(employee, granularity = this.state.employeeLoadGranularity) {
    this.setDynamicGranularity('employee', granularity);
    this.updateDynamicChart('employee', 'historyChart', employee);
  },
  toggleTaskDetails(taskId) {
    if (this.state.expandedTasks.has(taskId)) {
      this.state.expandedTasks.delete(taskId);
    } else {
      this.state.expandedTasks.add(taskId);
    }
    if (this.state.currentPage === 'employee') {
      this.renderEmployeePageWithTransition();
    }
  },
  getStatusClass(status) {
    if (status === 'Назначена' || status === 'Назначен' || status === 'В процессе') return 'status-pill--process';
    if (status === 'На проверке') return 'status-pill--warning';
    if (status === 'Отложена' || status === 'Отложено') return 'status-pill--warning';
    if (status === 'Завершена' || status === 'Завершено' || status === 'Выполнено' || status === 'В срок') return 'status-pill--done';
    if (status === 'Не в срок' || status === 'Просрочено') return 'status-pill--delay';
    return 'status-pill--neutral';
  },
  getBadgeClass(color) {
    const value = String(color || '').toLowerCase();
    if (value === '#ff682c' || value === '#f59e0b') return 'badge--accent';
    if (value === '#816729') return 'badge--secondary';
    return 'badge--neutral';
  },
  escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
};

function initApp() {
  StaffApp.init();
}

window.initApp = initApp;
document.addEventListener('DOMContentLoaded', () => initApp());
