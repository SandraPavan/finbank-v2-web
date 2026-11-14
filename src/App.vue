<template>
  <div class="layout">
    <header class="site-header">
      <p class="brand">FinBank V2</p>
    </header>
    <main class="content">
      <h1>FinBank V2</h1>
      <p>Ambiente educacional em preparação.</p>
    </main>
    <footer class="site-footer">
      <p>Ambiente educacional simulado.</p>
    </footer>
  </div>
</template>

<style scoped>
.layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  color: #1a1a1a;
  background: #ffffff;
  line-height: 1.5;
}

.site-header,
.site-footer {
  padding: 1rem 1.5rem;
  background: #f2f2f2;
}

.brand {
  margin: 0;
  font-weight: 600;
}

.content {
  flex: 1;
  padding: 2rem 1.5rem;
  max-width: 60rem;
}

.site-footer p {
  margin: 0;
  font-size: 0.875rem;
  color: #3d3d3d;
}

:focus-visible {
  outline: 3px solid #1a4fd6;
  outline-offset: 2px;
}
</style>
