import { SidebarContent } from './SidebarContent';

export function AdminSidebar() {
  return (
    <aside className="hidden md:flex w-64 flex-col border-r border-border bg-sidebar">
      <SidebarContent />
    </aside>
  );
}
