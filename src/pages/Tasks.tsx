import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, Play, X, RefreshCw, MoreHorizontal, Plus, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ClientAutocomplete } from "@/components/ClientAutocomplete";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

function typeLabel(type: string) {
  switch (type) {
    case "schedule_visit": return "Agendar Visita";
    case "stock_replenish": return "Reposição de Estoque";
    case "service_precheck": return "Pré-checagem de Serviço";
    case "demo_prepare": return "Preparar Demonstração";
    case "followup": return "Follow-up";
    default: return type;
  }
}

function statusBadge(status: string) {
  const variant = status === "pending" ? "secondary" : status === "in_progress" ? "default" : status === "completed" ? "default" : "destructive";
  return <Badge variant={variant as any}>{status === "pending" ? "Pendente" : status === "in_progress" ? "Em andamento" : status === "completed" ? "Concluída" : "Cancelada"}</Badge>;
}

function priorityBadge(priority: string) {
  const variant = priority === "high" ? "destructive" : priority === "medium" ? "default" : "secondary";
  return <Badge variant={variant as any}>{priority === "high" ? "Alta" : priority === "medium" ? "Média" : "Baixa"}</Badge>;
}

type UserOption = {
  auth_user_id: string;
  name: string | null;
  role: string | null;
};

export default function TasksPage() {
  const { user, userRole } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("open"); // open=pending+in_progress
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Estado do diálogo de nova tarefa
  const [createOpen, setCreateOpen] = useState(false);
  const [newClientId, setNewClientId] = useState<string>("");
  const [newType, setNewType] = useState<string>("schedule_visit");
  const [newPriority, setNewPriority] = useState<string>("medium");
  const [newDueAt, setNewDueAt] = useState<string>("");
  const [newNotes, setNewNotes] = useState<string>("");

  // Estado do diálogo de edição de tarefa
  const [editOpen, setEditOpen] = useState(false);
  const [editTask, setEditTask] = useState<any | null>(null);
  const [editClientId, setEditClientId] = useState<string>("");
  const [editType, setEditType] = useState<string>("schedule_visit");
  const [editPriority, setEditPriority] = useState<string>("medium");
  const [editDueAt, setEditDueAt] = useState<string>("");
  const [editNotes, setEditNotes] = useState<string>("");
  const [editResponsibleId, setEditResponsibleId] = useState<string>(user?.id ?? "");
  const [editAssignedUsers, setEditAssignedUsers] = useState<string[]>(user?.id ? [user.id] : []);

  // Usuários (responsável e atribuídos)
  const [users, setUsers] = useState<UserOption[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [newResponsibleId, setNewResponsibleId] = useState<string>(user?.id ?? "");
  const [newAssignedUsers, setNewAssignedUsers] = useState<string[]>(user?.id ? [user.id] : []);

  useEffect(() => {
    let active = true;
    async function fetchUsers() {
      setUsersLoading(true);
      setUsersError(null);
      try {
        const { data, error } = await supabase
          .from("users" as any)
          .select("auth_user_id, name, role, status")
          .eq("status", "active")
          .order("name", { ascending: true });
        if (error) throw error;
        if (active) setUsers((data ?? []).filter((u: any) => !!u.auth_user_id));
      } catch (err: any) {
        if (active) setUsersError(err.message ?? "Falha ao carregar usuários");
      } finally {
        if (active) setUsersLoading(false);
      }
    }
    fetchUsers();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (newResponsibleId) {
      setNewAssignedUsers(prev => {
        const set = new Set(prev);
        set.add(newResponsibleId);
        if (user?.id) set.add(user.id);
        return Array.from(set);
      });
    }
  }, [newResponsibleId, user?.id]);

  // Manter consistência dos responsáveis atribuídos ao editar
  useEffect(() => {
    if (editResponsibleId) {
      setEditAssignedUsers(prev => {
        const set = new Set(prev);
        set.add(editResponsibleId);
        if (user?.id) set.add(user.id);
        return Array.from(set);
      });
    }
  }, [editResponsibleId, user?.id]);

  const toggleAssignedUser = (id: string) => {
    setNewAssignedUsers(prev => {
      const exists = prev.includes(id);
      let next = exists ? prev.filter(v => v !== id) : [...prev, id];
      // Garantir que o usuário atual permaneça atribuído
      if (user?.id && !next.includes(user.id)) next.push(user.id);
      // Garantir que o responsável principal esteja incluído
      if (newResponsibleId && !next.includes(newResponsibleId)) next.push(newResponsibleId);
      return Array.from(new Set(next));
    });
  };

  const assignedSummary = () => {
    if (!newAssignedUsers.length) return "Nenhum";
    const names = users
      .filter(u => newAssignedUsers.includes(u.auth_user_id))
      .map(u => u.name || "Sem nome");
    return names.length > 3 ? `${names.slice(0, 3).join(", ")} +${names.length - 3}` : names.join(", ");
  };

  const { data: tasks, isLoading, refetch } = useQuery({
    queryKey: ["tasks", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("tasks" as any)
        .select(`*, clients!tasks_client_id_fkey (id, farm_name, contact_name, city, seller_auth_id, owner_user_id)`)
        .order("due_at", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const insert: any = {
        client_id: newClientId || null,
        type: newType,
        due_at: newDueAt ? new Date(newDueAt).toISOString() : null,
        priority: newPriority,
        notes: newNotes || null,
        responsible_auth_id: newResponsibleId || user?.id,
        assigned_users: newAssignedUsers.length ? newAssignedUsers : (user?.id ? [user.id] : []),
        created_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("tasks" as any)
        .insert(insert);
      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('duplicate')) {
          console.warn('Duplicidade ao criar; tratando como sucesso.', error.message);
          return insert;
        }
        throw error;
      }
      return insert;
    },
    onSuccess: async () => {
      toast.success("Tarefa criada");
      setCreateOpen(false);
      // reset
      setNewClientId("");
      setNewType("schedule_visit");
      setNewPriority("medium");
      setNewDueAt("");
      setNewNotes("");
      setNewResponsibleId(user?.id ?? "");
      setNewAssignedUsers(user?.id ? [user.id] : []);
      refetch();
    },
    onError: (err: any) => {
      const msg = (err?.message || '').toLowerCase();
      if (msg.includes('duplicate')) {
        toast.success('Tarefa criada (duplicidade ignorada)');
        setCreateOpen(false);
        refetch();
        return;
      }
      toast.error(err.message || "Falha ao criar tarefa");
    }
  });

  // Edição de tarefas: handlers
  const toggleEditAssignedUser = (id: string) => {
    setEditAssignedUsers(prev => {
      const exists = prev.includes(id);
      let next = exists ? prev.filter(v => v !== id) : [...prev, id];
      if (user?.id && !next.includes(user.id)) next.push(user.id);
      if (editResponsibleId && !next.includes(editResponsibleId)) next.push(editResponsibleId);
      return Array.from(new Set(next));
    });
  };

  const editAssignedSummary = () => {
    if (!editAssignedUsers.length) return "Nenhum";
    const names = users
      .filter(u => editAssignedUsers.includes(u.auth_user_id))
      .map(u => u.name || "Sem nome");
    return names.length > 3 ? `${names.slice(0, 3).join(", ")} +${names.length - 3}` : names.join(", ");
  };

  const openEdit = (t: any) => {
    setEditTask(t);
    setEditOpen(true);
    setEditClientId(t.client_id || "");
    setEditType(t.type || "schedule_visit");
    setEditPriority(t.priority || "medium");
    setEditDueAt(t.due_at ? toInputDateTimeLocal(t.due_at) : "");
    setEditNotes(t.notes || "");
    setEditResponsibleId(t.responsible_auth_id || user?.id || "");
    const assigned = Array.isArray(t.assigned_users) ? t.assigned_users : [];
    const finalAssigned = Array.from(new Set([...assigned, t.responsible_auth_id, user?.id].filter(Boolean)));
    setEditAssignedUsers(finalAssigned);
  };

  const closeEdit = () => {
    setEditOpen(false);
    setEditTask(null);
    setEditClientId("");
    setEditType("schedule_visit");
    setEditPriority("medium");
    setEditDueAt("");
    setEditNotes("");
    setEditResponsibleId(user?.id ?? "");
    setEditAssignedUsers(user?.id ? [user.id] : []);
  };

  const updateMutation = useMutation({
    mutationFn: async ({ task, status }: { task: any; status: "pending" | "in_progress" | "completed" | "cancelled" }) => {
      const { error } = await supabase
        .from("tasks" as any)
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", task.id);
      if (error) throw error;
      return { status };
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      refetch();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Falha ao atualizar status");
    },
  });

  const saveEditMutation = useMutation({
    mutationFn: async () => {
      if (!editTask) throw new Error("Nenhuma tarefa para editar");
      const update: any = {
        client_id: editClientId || null,
        type: editType,
        due_at: editDueAt ? new Date(editDueAt).toISOString() : null,
        priority: editPriority,
        notes: editNotes || null,
        responsible_auth_id: editResponsibleId || user?.id,
        assigned_users: editAssignedUsers.length ? editAssignedUsers : (user?.id ? [user.id] : []),
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("tasks" as any)
        .update(update)
        .eq("id", editTask.id);
      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('duplicate')) {
          console.warn('Duplicidade ao editar; tratando como sucesso.', error.message);
          return update;
        }
        throw error;
      }
      return update;
    },
    onSuccess: async () => {
      toast.success("Tarefa editada");
      // Notificação automática desativada.
      closeEdit();
      refetch();
    },
    onError: (err: any) => {
      const msg = (err?.message || '').toLowerCase();
      if (msg.includes('duplicate')) {
        toast.success("Tarefa editada (duplicidade ignorada)");
        closeEdit();
        refetch();
        return;
      }
      toast.error(err.message || "Falha ao editar tarefa");
    }
  });

  const filtered = useMemo(() => {
    let list = tasks || [];

    // Mostrar apenas relevantes ao usuário: atribuídas/responsável ou clientes do vendedor
    list = list.filter((t: any) => {
      const assigned = Array.isArray(t.assigned_users) && t.assigned_users.includes(user?.id);
      const responsible = t.responsible_auth_id === user?.id;
      const myClient = t.clients && (t.clients.seller_auth_id === user?.id || t.clients.owner_user_id === user?.id);
      return assigned || responsible || myClient || userRole === 'admin' || userRole === 'technician';
    });

    if (statusFilter === "open") list = list.filter((t: any) => t.status === "pending" || t.status === "in_progress");
    if (statusFilter === "done") list = list.filter((t: any) => t.status === "completed");
    if (statusFilter === "cancelled") list = list.filter((t: any) => t.status === "cancelled");

    if (typeFilter !== "all") list = list.filter((t: any) => t.type === typeFilter);

    if (search) {
      const s = search.toLowerCase();
      list = list.filter((t: any) =>
        (t.clients?.farm_name?.toLowerCase().includes(s) ||
         t.clients?.contact_name?.toLowerCase().includes(s) ||
         t.notes?.toLowerCase().includes(s) ||
         typeLabel(t.type).toLowerCase().includes(s))
      );
    }

    // Ordenar por vencimento (due_at) e prioridade
    list.sort((a: any, b: any) => {
      const pa = a.priority === 'high' ? 2 : a.priority === 'medium' ? 1 : 0;
      const pb = b.priority === 'high' ? 2 : b.priority === 'medium' ? 1 : 0;
      const dueA = a.due_at ? new Date(a.due_at).getTime() : Number.MAX_SAFE_INTEGER;
      const dueB = b.due_at ? new Date(b.due_at).getTime() : Number.MAX_SAFE_INTEGER;
      if (dueA !== dueB) return dueA - dueB;
      return pb - pa; // alta primeiro
    });

    return list;
  }, [tasks, search, statusFilter, typeFilter, user?.id, userRole]);

  return (
    <AppLayout title="Tarefas">
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Minhas Tarefas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-2 md:gap-4 mb-4">
              <Input placeholder="Buscar por cliente, tipo ou notas" value={search} onChange={e => setSearch(e.target.value)} />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Abertas</SelectItem>
                  <SelectItem value="done">Concluídas</SelectItem>
                  <SelectItem value="cancelled">Canceladas</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="schedule_visit">Agendar Visita</SelectItem>
                  <SelectItem value="stock_replenish">Reposição de Estoque</SelectItem>
                  <SelectItem value="service_precheck">Pré-checagem de Serviço</SelectItem>
                  <SelectItem value="demo_prepare">Preparar Demonstração</SelectItem>
                  <SelectItem value="followup">Follow-up</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 md:ml-auto">
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Nova tarefa
                </Button>
                <Button variant="outline" onClick={() => refetch()}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
                </Button>
              </div>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notas</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <div className="py-6 text-center text-muted-foreground">Carregando tarefas...</div>
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && filtered?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <div className="py-6 text-center text-muted-foreground">Nenhuma tarefa encontrada</div>
                      </TableCell>
                    </TableRow>
                  )}

                  {filtered?.map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <div className="font-medium">{typeLabel(t.type)}</div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{t.clients?.farm_name || "—"}</div>
                          <div className="text-xs text-muted-foreground">{t.clients?.contact_name}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {t.due_at ? (
                          <div>
                            <div>{format(new Date(t.due_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Sem vencimento</span>
                        )}
                      </TableCell>
                      <TableCell>{priorityBadge(t.priority)}</TableCell>
                      <TableCell>{statusBadge(t.status)}</TableCell>
                      <TableCell className="max-w-[260px] truncate" title={t.notes || ""}>{t.notes || "—"}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline">
                              <MoreHorizontal className="h-4 w-4 mr-1" /> Ações
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              disabled={t.status !== "pending"}
                              onClick={() => updateMutation.mutate({ task: t, status: "in_progress" })}
                            >
                              <Play className="h-3.5 w-3.5 mr-2" /> Iniciar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={t.status === "completed"}
                              onClick={() => updateMutation.mutate({ task: t, status: "completed" })}
                            >
                              <Check className="h-3.5 w-3.5 mr-2" /> Concluir
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEdit(t)}>
                              <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={t.status === "cancelled"}
                              onClick={() => updateMutation.mutate({ task: t, status: "cancelled" })}
                            >
                              <X className="h-3.5 w-3.5 mr-2" /> Cancelar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Diálogo: Nova Tarefa */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Nova Tarefa</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={newType} onValueChange={setNewType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="schedule_visit">Agendar Visita</SelectItem>
                        <SelectItem value="stock_replenish">Reposição de Estoque</SelectItem>
                        <SelectItem value="service_precheck">Pré-checagem de Serviço</SelectItem>
                        <SelectItem value="demo_prepare">Preparar Demonstração</SelectItem>
                        <SelectItem value="followup">Follow-up</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Cliente</Label>
                    <ClientAutocomplete
                      value={newClientId}
                      onChange={setNewClientId}
                      userRole={userRole}
                      userId={user?.id}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Data e Hora</Label>
                    <Input
                      type="datetime-local"
                      value={newDueAt}
                      onChange={(e) => setNewDueAt(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Prioridade</Label>
                    <Select value={newPriority} onValueChange={setNewPriority}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Baixa</SelectItem>
                        <SelectItem value="medium">Média</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Responsável principal</Label>
                    <Select value={newResponsibleId} onValueChange={setNewResponsibleId}>
                      <SelectTrigger>
                        <SelectValue placeholder={usersLoading ? "Carregando..." : "Selecione"} />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map(u => (
                          <SelectItem key={u.auth_user_id} value={u.auth_user_id}>
                            {u.name || u.auth_user_id} {u.role ? `(${u.role})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Responsáveis atribuídos</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="justify-between">
                          <span>{assignedSummary()}</span>
                          <span className="text-muted-foreground">Selecionar</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80">
                        <div className="space-y-2">
                          {usersError && (
                            <p className="text-sm text-destructive">{usersError}</p>
                          )}
                          {usersLoading && (
                            <p className="text-sm text-muted-foreground">Carregando usuários...</p>
                          )}
                          {!usersLoading && users.map(u => {
                            const checked = newAssignedUsers.includes(u.auth_user_id);
                            return (
                              <div key={u.auth_user_id} className="flex items-center gap-3 py-1">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() => toggleAssignedUser(u.auth_user_id)}
                                  id={`user-${u.auth_user_id}`}
                                />
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback>{(u.name || u.auth_user_id || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <label htmlFor={`user-${u.auth_user_id}`} className="text-sm cursor-pointer">
                                  {u.name || u.auth_user_id} {u.role ? `(${u.role})` : ""}
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <Label>Notas</Label>
                    <Textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} />
                  </div>
                </div>
                <DialogFooter className="mt-4">
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                  <Button onClick={() => createMutation.mutate()} disabled={!newType || !newDueAt || createMutation.isPending}>
                    <Plus className="h-4 w-4 mr-2" /> Criar
                  </Button>
                </DialogFooter>
              </DialogContent>
             </Dialog>

             {/* Diálogo: Editar Tarefa */}
             <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setEditTask(null); }}>
               <DialogContent>
                 <DialogHeader>
                   <DialogTitle>Editar Tarefa</DialogTitle>
                 </DialogHeader>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                   <div className="space-y-2">
                     <Label>Tipo</Label>
                     <Select value={editType} onValueChange={setEditType}>
                       <SelectTrigger>
                         <SelectValue />
                       </SelectTrigger>
                       <SelectContent>
                         <SelectItem value="schedule_visit">Agendar Visita</SelectItem>
                         <SelectItem value="stock_replenish">Reposição de Estoque</SelectItem>
                         <SelectItem value="service_precheck">Pré-checagem de Serviço</SelectItem>
                         <SelectItem value="demo_prepare">Preparar Demonstração</SelectItem>
                         <SelectItem value="followup">Follow-up</SelectItem>
                       </SelectContent>
                     </Select>
                   </div>
                   <div className="space-y-2">
                     <Label>Cliente</Label>
                     <ClientAutocomplete
                       value={editClientId}
                       onChange={setEditClientId}
                       userRole={userRole}
                       userId={user?.id}
                     />
                   </div>
                   <div className="space-y-2">
                     <Label>Data e Hora</Label>
                     <Input
                       type="datetime-local"
                       value={editDueAt}
                       onChange={(e) => setEditDueAt(e.target.value)}
                     />
                   </div>
                   <div className="space-y-2">
                     <Label>Prioridade</Label>
                     <Select value={editPriority} onValueChange={setEditPriority}>
                       <SelectTrigger>
                         <SelectValue />
                       </SelectTrigger>
                       <SelectContent>
                         <SelectItem value="low">Baixa</SelectItem>
                         <SelectItem value="medium">Média</SelectItem>
                         <SelectItem value="high">Alta</SelectItem>
                       </SelectContent>
                     </Select>
                   </div>
                   <div className="space-y-2">
                     <Label>Responsável principal</Label>
                     <Select value={editResponsibleId} onValueChange={setEditResponsibleId}>
                       <SelectTrigger>
                         <SelectValue placeholder={usersLoading ? "Carregando..." : "Selecione"} />
                       </SelectTrigger>
                       <SelectContent>
                         {users.map(u => (
                           <SelectItem key={u.auth_user_id} value={u.auth_user_id}>
                             {u.name || u.auth_user_id} {u.role ? `(${u.role})` : ""}
                           </SelectItem>
                         ))}
                       </SelectContent>
                     </Select>
                   </div>
                   <div className="space-y-2">
                     <Label>Responsáveis atribuídos</Label>
                     <Popover>
                       <PopoverTrigger asChild>
                         <Button variant="outline" className="justify-between">
                           <span>{editAssignedSummary()}</span>
                           <span className="text-muted-foreground">Selecionar</span>
                         </Button>
                       </PopoverTrigger>
                       <PopoverContent className="w-80">
                         <div className="space-y-2">
                           {usersError && (
                             <p className="text-sm text-destructive">{usersError}</p>
                           )}
                           {usersLoading && (
                             <p className="text-sm text-muted-foreground">Carregando usuários...</p>
                           )}
                           {!usersLoading && users.map(u => {
                             const checked = editAssignedUsers.includes(u.auth_user_id);
                             return (
                               <div key={u.auth_user_id} className="flex items-center gap-3 py-1">
                                 <Checkbox
                                   checked={checked}
                                   onCheckedChange={() => toggleEditAssignedUser(u.auth_user_id)}
                                   id={`edit-user-${u.auth_user_id}`}
                                 />
                                 <Avatar className="h-6 w-6">
                                   <AvatarFallback>{(u.name || u.auth_user_id || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                                 </Avatar>
                                 <label htmlFor={`edit-user-${u.auth_user_id}`} className="text-sm cursor-pointer">
                                   {u.name || u.auth_user_id} {u.role ? `(${u.role})` : ""}
                                 </label>
                               </div>
                             );
                           })}
                         </div>
                       </PopoverContent>
                     </Popover>
                   </div>
                   <div className="md:col-span-2 space-y-2">
                     <Label>Notas</Label>
                     <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
                   </div>
                 </div>
                 <DialogFooter className="mt-4">
                   <Button variant="outline" onClick={() => closeEdit()}>Cancelar</Button>
                   <Button onClick={() => saveEditMutation.mutate()} disabled={!editType || saveEditMutation.isPending}>
                     <Check className="h-4 w-4 mr-2" /> Salvar
                   </Button>
                 </DialogFooter>
               </DialogContent>
             </Dialog>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function toInputDateTimeLocal(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => (n < 10 ? "0" + n : "" + n);
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}