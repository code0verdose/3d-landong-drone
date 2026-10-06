import { createRootRoute, Link, Outlet } from '@tanstack/react-router';

export const Route = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: () => (
    <div style={{ minHeight: '100vh', display: 'grid', placeContent: 'center', gap: 16, color: '#eee', textAlign: 'center' }}>
      <p>Такой страницы нет.</p>
      <Link to="/" style={{ color: '#ff7a3d' }}>На главную</Link>
    </div>
  ),
});
