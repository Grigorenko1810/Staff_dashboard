<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Аналитика по сотрудникам</title>
    <link rel="stylesheet" href="style.css">
  </head>
  <body data-page="dashboard">
    <div id="legacyAppShell" class="legacy-app-shell">
      <div class="app-shell">
        <aside class="sidebar">
          <div class="sidebar__brand">
            <div class="sidebar__logo">S</div>
            <div>
              <h1>Staff Analytics</h1>
              <p>Прототип аналитики</p>
            </div>
          </div>
          <nav class="sidebar__nav" id="sidebar-nav"></nav>
          <div class="sidebar__footer">
            <button class="button button--ghost" id="importBtn">Импорт Excel</button>
            <input type="file" id="excelInput" accept=".xlsx,.xls,.csv" hidden>
          </div>
        </aside>
        <main class="main">
          <header class="topbar">
            <div class="topbar__title" id="pageTitle">Главная</div>
            <div class="topbar__actions">
              <div class="chip">Обновлено 5 мин назад</div>
              <button class="button button--primary" id="refreshBtn">Обновить</button>
            </div>
          </header>
          <div id="pageContent" class="page-content"></div>
        </main>
      </div>
      <div id="employeePreviewRoot"></div>
      <div id="floatingPanelsRoot"></div>
    </div>

    <div id="staffAppRoot" class="staff-app-root"></div>

    <script src="vendor/chart.umd.js"></script>
    <script src="vendor/xlsx.full.min.js"></script>
    <script src="data.js"></script>
    <script src="script.js"></script>
    <script src="staff-ui.js"></script>
  </body>
</html>
