(function () {
  const StaffApp = {
    namespace: 'StaffApp',
    mockData: window.mockData || {},
    state: {
      route: 'dashboard',
      employeeId: null,
      previewEmployeeId: null,
      filters: {
        search: '',
        center: '',
        management: '',
        status: ''
      }
    },
    init() {
      this.mount();
      this.bindRouter();
      this.bindGlobalKeys();
      this.render();
    },
    mount() {
      const root = document.getElementById('staffAppRoot');
      if (!root) return;
      root.innerHTML = '<div class="staff-prototype-shell"></div>';
    },
    bindRouter() {
      window.addEventListener('hashchange', () => this.render());
    },
    bindGlobalKeys() {
      document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        if (this.state.route === 'employees' && this.state.previewEmployeeId) {
          this.closePreview();
        }
      });
    },
    getRoute() {
      const hash = window.location.hash.replace('#', '').split('/');
      if (hash[0] === 'employees') return 'employees';
      if (hash[0] === 'employee' && hash[1]) return { type: 'employee', id: hash[1] };
      return 'dashboard';
    },
    render() {
      const route = this.getRoute();
      const root = document.getElementById('staffAppRoot');
      if (!root) return;
      if (route === 'employees') {
        this.state.route = 'employees';
        root.innerHTML = this.renderEmployeesPage();
      } else if (route.type === 'employee') {
        this.state.route = 'employee';
        this.state.employeeId = Number(route.id);
        root.innerHTML = this.renderEmployeePage();
      } else {
        this.state.route = 'dashboard';
        root.innerHTML = this.renderDashboardPage();
      }
      this.bindEvents();
      if (this.state.route === 'employees') {
        this.bindEmployeesEvents();
      }
      if (this.state.route === 'dashboard') {
        this.renderDashboardCharts();
      }
    },
    renderDashboardPage() {
      const cards = (this.mockData.periodCards || []).map((card, index) => `
        <article class="staff-card staff-card--compact">
          <div class="staff-card__head">
            <div>
              <h3>${this.escapeHtml(card.title)}</h3>
              <p>${this.escapeHtml(card.subtitle)}</p>
            </div>
            <span class="staff-badge staff-badge--accent"><span class="percent-value percent-value--badge">${card.percent}%</span></span>
          </div>
          <div class="staff-donut">
            <canvas id="dashboardDonut${index}"></canvas>
            <div class="staff-donut__label percent-value">${card.percent}%</div>
          </div>
          <div class="staff-card__stack">
            <div class="staff-row"><span>Факт / план</span><strong>${card.fact}/${card.plan}</strong></div>
            <div class="staff-row"><span>Простой</span><strong>${card.idle}</strong></div>
            <div class="staff-row"><span>Отсутствие</span><strong>${card.missing}</strong></div>
          </div>
          <div class="staff-section-title">В разрезе видов проектов</div>
          <div class="staff-list">
            ${card.types.map((type) => `
              <div class="staff-list__item">
                <span>${this.escapeHtml(type.label)}</span>
                <span class="staff-badge" style="background: ${type.color}1A; color: ${type.color};"><span class="percent-value percent-value--badge">${type.value}%</span></span>
              </div>
            `).join('')}
          </div>
          <div class="staff-section-title">В разрезе центров</div>
          <div class="staff-list">
            ${card.centers.map((center) => `
              <div class="staff-list__item">
                <span>${this.escapeHtml(center.label)}</span>
                <span class="staff-badge" style="background: ${center.color}1A; color: ${center.color};"><span class="percent-value percent-value--badge">${center.value}%</span></span>
              </div>
            `).join('')}
          </div>
        </article>
      `).join('');

      return `
        <section class="staff-prototype-shell">
          <aside class="staff-sidebar">
            <div class="staff-sidebar__title">Аналитика</div>
            <nav class="staff-nav">
              <a class="staff-nav__item is-active" href="#dashboard">Главная</a>
              <a class="staff-nav__item" href="#employees">Сотрудники</a>
              <a class="staff-nav__item" href="#employee/1">Сотрудник</a>
            </nav>
          </aside>
          <div class="staff-main">
            <header class="staff-topbar">
              <div>
                <div class="staff-topbar__eyebrow">Прототип новой аналитики</div>
                <h1>Главная страница</h1>
              </div>
              <a class="staff-button staff-button--primary" href="#employees">Открыть сотрудников</a>
            </header>
            <section class="staff-grid staff-grid--five">
              ${cards}
            </section>
            <section class="staff-card staff-card--wide staff-card--chart">
              <div class="staff-card__head">
                <div>
                  <h3>Динамика загрузки по кварталам</h3>
                  <p>Сводка загрузки по кварталам 2026</p>
                </div>
                <span class="staff-badge staff-badge--success"><span class="percent-value percent-value--badge">13%</span> • III квартал</span>
              </div>
              <div class="staff-chart-large">
                <canvas id="dashboardLineChart"></canvas>
              </div>
            </section>
          </div>
        </section>
      `;
    },
    renderEmployeesPage() {
      const employees = this.mockData.employees || [];
      const centers = [...new Set(employees.map((employee) => employee.center))];
      const managements = [...new Set(employees.map((employee) => employee.management))];
      const statuses = [...new Set(employees.map((employee) => employee.status))];
      const filteredEmployees = this.getFilteredEmployees();

      const rows = filteredEmployees.map((employee) => `
        <tr data-employee-row data-employee-id="${employee.id}">
          <td>
            <div class="staff-user">
              <div class="staff-avatar">${this.escapeHtml(employee.shortName || employee.fullName)}</div>
              <div>
                <strong>${this.escapeHtml(employee.fullName)}</strong>
                <div class="staff-muted">${this.escapeHtml(employee.center)}</div>
              </div>
            </div>
          </td>
          <td>${this.escapeHtml(employee.position)}</td>
          <td>${this.escapeHtml(employee.management)}</td>
          <td><span class="staff-badge staff-badge--accent"><span class="percent-value percent-value--badge">${employee.loadPercent}%</span></span></td>
          <td>${employee.completedTasks}/${employee.tasksTotal}</td>
          <td><button type="button" class="staff-button staff-button--ghost" data-employee-profile="${employee.id}">Профиль</button></td>
        </tr>
      `).join('');

      return `
        <section class="staff-prototype-shell staff-prototype-shell--employees">
          <aside class="staff-sidebar">
            <div class="staff-sidebar__title">Сотрудники</div>
            <nav class="staff-nav">
              <a class="staff-nav__item" href="#dashboard">Главная</a>
              <a class="staff-nav__item is-active" href="#employees">Сотрудники</a>
              <a class="staff-nav__item" href="#employee/1">Сотрудник</a>
            </nav>
          </aside>
          <div class="staff-main">
            <header class="staff-topbar">
              <div>
                <div class="staff-topbar__eyebrow">Прототип новой аналитики</div>
                <h1>Сотрудники</h1>
              </div>
              <a class="staff-button staff-button--ghost" href="#dashboard">← Назад</a>
            </header>
            <section class="staff-kpi-grid">
              <article class="staff-kpi-card"><div class="staff-kpi-card__label">Всего сотрудников</div><div class="staff-kpi-card__value">520</div></article>
              <article class="staff-kpi-card"><div class="staff-kpi-card__label">Управления</div><div class="staff-kpi-card__value">25</div></article>
              <article class="staff-kpi-card"><div class="staff-kpi-card__label">Центры</div><div class="staff-kpi-card__value">4</div></article>
              <article class="staff-kpi-card"><div class="staff-kpi-card__label">Активные задачи</div><div class="staff-kpi-card__value">101</div></article>
            </section>
            <section class="staff-filter-card">
              <div class="staff-field staff-field--search">
                <label>Поиск</label>
                <input id="staffSearchInput" type="text" placeholder="Введите ФИО" value="${this.escapeHtml(this.state.filters.search)}">
              </div>
              <div class="staff-field">
                <label>Центр</label>
                <select id="staffCenterFilter">
                  <option value="">Все центры</option>
                  ${centers.map((center) => `<option value="${this.escapeHtml(center)}" ${this.state.filters.center === center ? 'selected' : ''}>${this.escapeHtml(center)}</option>`).join('')}
                </select>
              </div>
              <div class="staff-field">
                <label>Управление</label>
                <select id="staffManagementFilter">
                  <option value="">Все управления</option>
                  ${managements.map((management) => `<option value="${this.escapeHtml(management)}" ${this.state.filters.management === management ? 'selected' : ''}>${this.escapeHtml(management)}</option>`).join('')}
                </select>
              </div>
              <div class="staff-field">
                <label>Статус</label>
                <select id="staffStatusFilter">
                  <option value="">Все статусы</option>
                  ${statuses.map((status) => `<option value="${this.escapeHtml(status)}" ${this.state.filters.status === status ? 'selected' : ''}>${this.escapeHtml(status)}</option>`).join('')}
                </select>
              </div>
            </section>
            <section class="staff-card staff-card--wide staff-card--table">
              <div class="staff-card__head">
                <h3>Таблица сотрудников</h3>
                <span class="staff-badge staff-badge--neutral">${filteredEmployees.length} человек</span>
              </div>
              <div class="staff-table-wrap">
                <table class="staff-table">
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
                  <tbody>${rows}</tbody>
                </table>
              </div>
            </section>
            ${this.renderEmployeePreview()}
          </div>
        </section>
      `;
    },
    renderEmployeePreview() {
      const employeeId = this.state.previewEmployeeId;
      if (!employeeId) {
        return `<div class="staff-employee-preview" id="staffEmployeePreview"></div>`;
      }
      const employee = (this.mockData.employees || []).find((item) => item.id === employeeId);
      if (!employee) {
        return `<div class="staff-employee-preview" id="staffEmployeePreview"></div>`;
      }
      const plannedChange = this.formatChange(this.getPercentChange(employee.history.month));
      const actualChange = this.formatChange(this.getPercentChange(employee.history.week));
      const loadChange = this.formatChange(this.getPercentChange(employee.history.quarter));
      const tasksChange = this.formatChange(((employee.completedTasks / Math.max(1, employee.tasksTotal) - 0.75) * 100));

      return `
        <div class="staff-employee-preview is-visible" id="staffEmployeePreview">
          <div class="employee-preview__head employee-preview__header employee-preview__drag-handle">
            <button type="button" class="employee-preview__close" data-preview-close aria-label="Закрыть">
              <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
              </svg>
            </button>
          </div>
          <div class="employee-preview__body">
            <div>
              <div class="page-back">Карточка сотрудника</div>
              <h2 class="employee-preview__title">${this.escapeHtml(employee.fullName)}</h2>
              <p class="staff-muted">${this.escapeHtml(employee.center)}, ${this.escapeHtml(employee.management)}, ${this.escapeHtml(employee.department)}</p>
              <p class="staff-muted">${this.escapeHtml(employee.position)}</p>
            </div>
            <div class="preview-kpi-grid">
              <article class="preview-kpi-card">
                <div class="preview-kpi-card__label">Плановые часы</div>
                <div class="preview-kpi-card__value">${employee.plannedHours}</div>
                <div class="preview-kpi-card__delta">${plannedChange}</div>
              </article>
              <article class="preview-kpi-card">
                <div class="preview-kpi-card__label">Фактические часы</div>
                <div class="preview-kpi-card__value">${employee.actualHours}</div>
                <div class="preview-kpi-card__delta">${actualChange}</div>
              </article>
              <article class="preview-kpi-card">
                <div class="preview-kpi-card__label">Загрузка</div>
                <div class="preview-kpi-card__value percent-value">${employee.loadPercent}%</div>
                <div class="preview-kpi-card__delta">${loadChange}</div>
              </article>
              <article class="preview-kpi-card">
                <div class="preview-kpi-card__label">Задач всего</div>
                <div class="preview-kpi-card__value">${employee.tasksTotal}</div>
                <div class="preview-kpi-card__delta">${tasksChange}</div>
              </article>
            </div>
            <div class="preview-actions">
              <button type="button" class="button button--primary" data-preview-detail="${employee.id}">Подробнее</button>
              <button type="button" class="button button--ghost" data-preview-next>Следующий</button>
            </div>
          </div>
        </div>
      `;
    },
    getFilteredEmployees() {
      const employees = this.mockData.employees || [];
      const search = String(this.state.filters.search || '').trim().toLowerCase();
      return employees.filter((employee) => {
        const matchesSearch = !search || employee.fullName.toLowerCase().includes(search);
        const matchesCenter = !this.state.filters.center || employee.center === this.state.filters.center;
        const matchesManagement = !this.state.filters.management || employee.management === this.state.filters.management;
        const matchesStatus = !this.state.filters.status || employee.status === this.state.filters.status;
        return matchesSearch && matchesCenter && matchesManagement && matchesStatus;
      });
    },
    openPreview(employeeId) {
      this.state.previewEmployeeId = Number(employeeId);
      this.render();
    },
    closePreview() {
      this.state.previewEmployeeId = null;
      this.render();
    },
    showNextPreview() {
      const filteredEmployees = this.getFilteredEmployees();
      if (!filteredEmployees.length) return;
      const currentIndex = filteredEmployees.findIndex((employee) => employee.id === this.state.previewEmployeeId);
      const nextIndex = currentIndex >= 0 && currentIndex < filteredEmployees.length - 1 ? currentIndex + 1 : 0;
      this.state.previewEmployeeId = filteredEmployees[nextIndex].id;
      this.render();
    },
    getPercentChange(values) {
      if (!Array.isArray(values) || values.length < 2) return 0;
      const previous = values[values.length - 2] || values[values.length - 1];
      const current = values[values.length - 1];
      if (previous === 0) return 0;
      return ((current - previous) / Math.abs(previous)) * 100;
    },
    formatChange(value) {
      const rounded = Number(value.toFixed(1));
      const sign = rounded >= 0 ? '+' : '';
      return `${sign}${rounded}%`;
    },
    renderEmployeePage() {
      const employee = (this.mockData.employees || []).find((item) => item.id === this.state.employeeId) || (this.mockData.employees || [])[0];
      if (!employee) {
        return `<div class="staff-empty">Сотрудник не найден</div>`;
      }
      return `
        <section class="staff-prototype-shell">
          <aside class="staff-sidebar">
            <div class="staff-sidebar__title">Карточка сотрудника</div>
            <nav class="staff-nav">
              <a class="staff-nav__item" href="#dashboard">Главная</a>
              <a class="staff-nav__item" href="#employees">Сотрудники</a>
              <a class="staff-nav__item is-active" href="#employee/${employee.id}">Сотрудник</a>
            </nav>
          </aside>
          <div class="staff-main">
            <header class="staff-topbar">
              <div>
                <div class="staff-topbar__eyebrow">Прототип новой аналитики</div>
                <h1>${this.escapeHtml(employee.fullName)}</h1>
                <p class="staff-muted">${this.escapeHtml(employee.center)} • ${this.escapeHtml(employee.management)} • ${this.escapeHtml(employee.department)}</p>
              </div>
              <a class="staff-button staff-button--ghost" href="#employees">← Сотрудники</a>
            </header>
            <section class="staff-card staff-card--wide">
              <div class="staff-card__head">
                <h3>Отчётный период</h3>
                <span class="staff-badge staff-badge--accent">Неделя</span>
              </div>
              <div class="staff-kpi-grid">
                <article class="staff-kpi-card"><div class="staff-kpi-card__label">Плановые часы</div><div class="staff-kpi-card__value">${employee.plannedHours}</div></article>
                <article class="staff-kpi-card"><div class="staff-kpi-card__label">Фактические часы</div><div class="staff-kpi-card__value">${employee.actualHours}</div></article>
                <article class="staff-kpi-card"><div class="staff-kpi-card__label">Загрузка</div><div class="staff-kpi-card__value percent-value">${employee.loadPercent}%</div></article>
                <article class="staff-kpi-card"><div class="staff-kpi-card__label">Задач всего</div><div class="staff-kpi-card__value">${employee.tasksTotal}</div></article>
              </div>
            </section>
            <section class="staff-grid">
              <article class="staff-card">
                <div class="staff-card__head"><h3>Сравнение времени</h3></div>
                <div class="staff-chart-placeholder">Bar chart placeholder</div>
              </article>
              <article class="staff-card">
                <div class="staff-card__head"><h3>Распределение задач</h3></div>
                <div class="staff-chart-placeholder">Donut chart placeholder</div>
              </article>
            </section>
            <section class="staff-card">
              <div class="staff-card__head"><h3>Загрузка</h3></div>
              <div class="staff-table-wrap">
                <table class="staff-table">
                  <thead>
                    <tr>
                      <th>Проект</th>
                      <th>Задача</th>
                      <th>Статус</th>
                      <th>Назначил/участники</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td>Платформа BI</td><td>Подготовка отчётов</td><td><span class="staff-badge staff-badge--neutral">В процессе</span></td><td>М. Кузнецов</td></tr>
                    <tr><td>CRM Evolution</td><td>Сводные метрики</td><td><span class="staff-badge staff-badge--success">Выполнено</span></td><td>А. Пономарёв</td></tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </section>
      `;
    },
    bindEvents() {
      const navLinks = document.querySelectorAll('.staff-nav__item');
      navLinks.forEach((link) => {
        link.addEventListener('click', () => {
          setTimeout(() => this.render(), 50);
        });
      });
      const topButtons = document.querySelectorAll('.staff-topbar .staff-button');
      topButtons.forEach((button) => {
        button.addEventListener('click', () => {
          setTimeout(() => this.render(), 50);
        });
      });
    },
    bindEmployeesEvents() {
      const searchInput = document.getElementById('staffSearchInput');
      const centerSelect = document.getElementById('staffCenterFilter');
      const managementSelect = document.getElementById('staffManagementFilter');
      const statusSelect = document.getElementById('staffStatusFilter');
      if (searchInput) {
        searchInput.addEventListener('input', (event) => {
          this.state.filters.search = event.target.value;
          this.render();
        });
      }
      if (centerSelect) {
        centerSelect.addEventListener('change', (event) => {
          this.state.filters.center = event.target.value;
          this.render();
        });
      }
      if (managementSelect) {
        managementSelect.addEventListener('change', (event) => {
          this.state.filters.management = event.target.value;
          this.render();
        });
      }
      if (statusSelect) {
        statusSelect.addEventListener('change', (event) => {
          this.state.filters.status = event.target.value;
          this.render();
        });
      }
      const rows = document.querySelectorAll('[data-employee-row]');
      rows.forEach((row) => {
        row.addEventListener('click', () => {
          this.openPreview(row.dataset.employeeId);
        });
      });
      const profileButtons = document.querySelectorAll('[data-employee-profile]');
      profileButtons.forEach((button) => {
        button.addEventListener('click', (event) => {
          event.stopPropagation();
          this.openPreview(button.dataset.employeeProfile);
        });
      });
      const closeButton = document.querySelector('[data-preview-close]');
      if (closeButton) {
        closeButton.addEventListener('click', () => this.closePreview());
      }
      const nextButton = document.querySelector('[data-preview-next]');
      if (nextButton) {
        nextButton.addEventListener('click', () => this.showNextPreview());
      }
      const detailButton = document.querySelector('[data-preview-detail]');
      if (detailButton) {
        detailButton.addEventListener('click', () => {
          window.location.href = `employee.html?id=${detailButton.dataset.previewDetail}`;
        });
      }
    },
    renderDashboardCharts() {
      const cards = this.mockData.periodCards || [];
      cards.forEach((card, index) => {
        const canvas = document.getElementById(`dashboardDonut${index}`);
        if (!canvas || typeof Chart === 'undefined') return;
        new Chart(canvas, {
          type: 'doughnut',
          data: {
            labels: card.types.map((item) => item.label),
            datasets: [{ data: card.types.map((item) => item.value), backgroundColor: card.types.map((item) => item.color), borderWidth: 0 }]
          },
          options: {
            cutout: '74%',
            radius: '88%',
            rotation: -90,
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 450, easing: 'easeOutQuart' },
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: '#202020',
                titleColor: '#ffffff',
                bodyColor: '#ffffff',
                borderWidth: 0,
                padding: 12,
                cornerRadius: 0,
                displayColors: false
              }
            },
            elements: { arc: { borderWidth: 0, borderRadius: 3, spacing: 1 } }
          }
        });
      });
      const lineCanvas = document.getElementById('dashboardLineChart');
      if (lineCanvas && typeof Chart !== 'undefined') {
        new Chart(lineCanvas, {
          type: 'line',
          data: {
            labels: this.mockData.quarterlyLoad.map((item) => item.quarter),
            datasets: [{
              label: 'Загрузка',
              data: this.mockData.quarterlyLoad.map((item) => item.value),
              borderColor: '#ff682c',
              backgroundColor: 'rgba(255,104,44,0.10)',
              fill: true,
              tension: 0.3,
              pointRadius: 2,
              pointHoverRadius: 5,
              pointBackgroundColor: '#ffffff',
              pointBorderColor: '#ff682c',
              pointBorderWidth: 1.5
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 450, easing: 'easeOutQuart' },
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: '#202020',
                titleColor: '#ffffff',
                bodyColor: '#ffffff',
                borderWidth: 0,
                padding: 12,
                cornerRadius: 0,
                displayColors: false
              }
            },
            scales: {
              x: { grid: { display: false }, ticks: { color: '#828282', font: { family: 'Inter, system-ui, sans-serif', size: 12 } }, border: { display: false } },
              y: { beginAtZero: true, ticks: { color: '#828282', stepSize: 10, font: { family: 'Inter, system-ui, sans-serif', size: 12 } }, grid: { color: '#e8e8e8', lineWidth: 1, drawBorder: false }, border: { display: false } }
            }
          }
        });
      }
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

  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('pageContent')) return;
    window.StaffApp = StaffApp;
    StaffApp.init();
  });
})();
