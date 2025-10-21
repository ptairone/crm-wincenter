import { useEffect, useMemo, useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ClientAutocomplete } from "@/components/ClientAutocomplete";
import { Plus, RefreshCw, Upload, Image as ImageIcon, Check, Pencil, FileText, Printer, Users } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

function statusBadge(status: string) {
  const map: Record<string, string> = {
    scheduled: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-gray-100 text-gray-800",
  };
  const cls = map[status] || "bg-gray-100 text-gray-800";
  return <span className={`inline-flex items-center px-2 py-1 rounded ${cls}`}>{status}</span>;
}

function typeLabel(type: string) {
  switch (type) {
    case "maintenance": return "Manutenção";
    case "revision": return "Revisão";
    case "spraying": return "Pulverização";
    default: return type;
  }
}

export default function ServiceOrders() {
  const { user, userRole } = useAuth();
   const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  // Create form state
  const [newClientId, setNewClientId] = useState<string>("");
  const [newType, setNewType] = useState<string>("maintenance");
  const [newDate, setNewDate] = useState<string>("");
  const [newNotes, setNewNotes] = useState<string>("");
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [includeSelf, setIncludeSelf] = useState(true);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState<boolean>(false);
  const [usersError, setUsersError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setUsersLoading(true);
        setUsersError(null);
        const { data, error } = await supabase
          .from('users')
          .select('auth_user_id, name, role')
          .in('role', ['seller', 'technician', 'admin'])
          .eq('status', 'active')
          .order('name');
        if (error) throw error;
        setUsers(data || []);
      } catch (err: any) {
        console.error('Error fetching users:', err);
        setUsersError(err?.message || 'Falha ao carregar usuários');
      } finally {
        setUsersLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const toggleAssignee = (id: string) => {
    setSelectedAssignees(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const assigneesSummary = () => {
    if (selectedAssignees.length === 0) return 'Nenhum usuário adicional';
    if (selectedAssignees.length === 1) {
      const u = users.find(x => x.auth_user_id === selectedAssignees[0]);
      return u?.name || '1 selecionado';
    }
    return `${selectedAssignees.length} usuários selecionados`;
  };

  const onSelectFiles = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files);
    setNewFiles(prev => [...prev, ...arr]);
  };

  const removeNewFile = (idx: number) => {
    setNewFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const { data: services, isLoading, refetch } = useQuery({
    queryKey: ["services", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("services" as any)
        .select(`*, clients!services_client_id_fkey (id, farm_name, contact_name)`) 
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  const uploadImage = async (serviceId: string, file: File): Promise<string | null> => {
    try {
      const ext = file.name.split(".").pop();
      const path = `services/${serviceId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("service-photos")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      return path; // store path, derive public URL when rendering
    } catch (error: any) {
      toast.error("Falha ao enviar imagem");
      console.error(error);
      return null;
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      if (!newClientId || !newType || !newDate) throw new Error("Preencha cliente, tipo e data");
      const insert: any = {
        client_id: newClientId,
        service_type: newType,
        date: new Date(newDate).toISOString(),
        status: "scheduled",
        notes: newNotes || null,
        assigned_users: Array.from(new Set([...(includeSelf && user?.id ? [user.id] : []), ...selectedAssignees])),
      };
      const { data, error } = await supabase
        .from("services" as any)
        .insert(insert)
        .select("id")
        .single();
      if (error) throw error;
      const serviceId = data?.id as string;
      let paths: string[] = [];
      for (const f of newFiles) {
        const p = await uploadImage(serviceId, f);
        if (p) paths.push(p);
      }
      if (paths.length) {
        const { error: updErr } = await supabase
          .from("services" as any)
          .update({ photos: paths })
          .eq("id", serviceId);
        if (updErr) console.warn("Falha ao atualizar fotos", updErr.message);
      }
      return serviceId;
    },
    onSuccess: async () => {
      toast.success("O.S criada");
      setCreateOpen(false);
      // reset form
      setNewClientId("");
      setNewType("maintenance");
      setNewDate("");
      setNewNotes("");
      setNewFiles([]);
      refetch();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Falha ao criar O.S");
    }
  });

  const [editNotes, setEditNotes] = useState<string>("");
  const [editDate, setEditDate] = useState<string>("");
  const [editType, setEditType] = useState<string>("maintenance");
  const [editStatus, setEditStatus] = useState<string>("scheduled");
  const [editFiles, setEditFiles] = useState<File[]>([]);

  const openEdit = (svc: any) => {
    setEditing(svc);
    setEditOpen(true);
    setEditNotes(svc?.notes || "");
    setEditDate(svc?.date ? toInputDateTimeLocal(svc.date) : "");
    setEditType(svc?.service_type || "maintenance");
    setEditStatus(svc?.status || "scheduled");
    setEditFiles([]);
  };

  const onSelectEditFiles = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files);
    setEditFiles(prev => [...prev, ...arr]);
  };

  // Laudo (report) state
  const [reportOpen, setReportOpen] = useState(false);
  const [reportService, setReportService] = useState<any | null>(null);
  const [reportContent, setReportContent] = useState<string>("");

  const openReport = (svc: any) => {
    setReportService(svc);
    setReportContent(svc?.notes || "");
    setReportOpen(true);
  };

  const saveReportMutation = useMutation({
    mutationFn: async () => {
      if (!reportService) throw new Error("Nenhuma O.S para laudo");
      const { error } = await supabase
        .from("services" as any)
        .update({ notes: reportContent || null })
        .eq("id", reportService.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Laudo atualizado");
      setReportOpen(false);
      setReportService(null);
      setReportContent("");
      refetch();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Falha ao salvar laudo");
    }
  });

  const printReport = () => {
    if (!reportService) return;
    const clientName = reportService.clients?.farm_name || "—";
    const contactName = reportService.clients?.contact_name || "";
    const type = typeLabel(reportService.service_type);
    const date = reportService.date ? new Date(reportService.date).toLocaleString() : "—";
    const status = reportService.status;
    const photos: string[] = Array.isArray(reportService.photos) ? reportService.photos : [];
    const photoTags = photos.map(p => `<img src="${publicUrl(p)}" style="width:160px;height:160px;object-fit:cover;margin:6px;border-radius:4px;border:1px solid #ddd" />`).join("");

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Laudo da O.S</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
            h1 { font-size: 20px; margin-bottom: 4px; }
            .muted { color: #555; }
            .section { margin-top: 16px; }
            .box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
            .photos { display: flex; flex-wrap: wrap; }
            .label { font-weight: 600; }
            .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
          </style>
        </head>
        <body>
          <h1>Laudo da Ordem de Serviço</h1>
          <div class="muted">Gerado em ${new Date().toLocaleString()}</div>

          <div class="section box">
            <div class="row">
              <div><span class="label">Cliente:</span> ${clientName}</div>
              <div><span class="label">Contato:</span> ${contactName}</div>
              <div><span class="label">Tipo:</span> ${type}</div>
              <div><span class="label">Data:</span> ${date}</div>
              <div><span class="label">Status:</span> ${status}</div>
            </div>
          </div>

          <div class="section box">
            <div class="label">Laudo</div>
            <div>${(reportContent || "").replace(/\n/g, "<br/>")}</div>
          </div>

          ${photos.length ? `
          <div class="section box">
            <div class="label">Fotos</div>
            <div class="photos">${photoTags}</div>
          </div>` : ""}

          <script>
            window.onload = function(){ setTimeout(function(){ window.print(); }, 200); };
          </script>
        </body>
      </html>
    `;

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  const saveEditMutation = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error("Nenhuma O.S para editar");
      const update: any = {
        notes: editNotes || null,
        service_type: editType,
        status: editStatus,
        date: editDate ? new Date(editDate).toISOString() : null,
      };
      const { error } = await supabase
        .from("services" as any)
        .update(update)
        .eq("id", editing.id);
      if (error) throw error;
      // upload new files
      let newPaths: string[] = [];
      for (const f of editFiles) {
        const p = await uploadImage(editing.id, f);
        if (p) newPaths.push(p);
      }
      if (newPaths.length) {
        const merged = Array.from(new Set([...(editing.photos || []), ...newPaths]));
        const { error: updErr } = await supabase
          .from("services" as any)
          .update({ photos: merged })
          .eq("id", editing.id);
        if (updErr) console.warn("Falha ao atualizar fotos", updErr.message);
      }
      return update;
    },
    onSuccess: async () => {
      toast.success("O.S atualizada");
      setEditOpen(false);
      setEditing(null);
      refetch();
    },
    onError: (err: any) => {
      toast.error(err?.message || "Falha ao atualizar O.S");
    }
  });

  const filtered = useMemo(() => {
    const list = (services || []) as any[];
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(s => {
      const txt = `${s.clients?.farm_name || ""} ${s.clients?.contact_name || ""} ${s.notes || ""}`.toLowerCase();
      return txt.includes(q) || s.service_type?.toLowerCase().includes(q) || s.status?.toLowerCase().includes(q);
    });
  }, [services, search]);

  const publicUrl = (path: string) => {
    const { data: { publicUrl } } = supabase.storage
      .from("service-photos")
      .getPublicUrl(path);
    return publicUrl;
  };

  return (
    <AppLayout title="Ordens de Serviço">
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Minhas O.S</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-2 md:gap-4 mb-4">
              <Input placeholder="Buscar por cliente, tipo, status ou laudo" value={search} onChange={e => setSearch(e.target.value)} />
              <div className="flex items-center gap-2 md:ml-auto">
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Nova O.S
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
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Laudo</TableHead>
                    <TableHead>Fotos</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <div className="py-6 text-center text-muted-foreground">Carregando O.S...</div>
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && filtered?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <div className="py-6 text-center text-muted-foreground">Nenhuma O.S encontrada</div>
                      </TableCell>
                    </TableRow>
                  )}

                  {filtered?.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="font-medium">{typeLabel(s.service_type)}</div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{s.clients?.farm_name || "—"}</div>
                          <div className="text-xs text-muted-foreground">{s.clients?.contact_name}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {s.date ? (
                          <div>{new Date(s.date).toLocaleString()}</div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{statusBadge(s.status)}</TableCell>
                      <TableCell className="max-w-[240px] truncate" title={s.notes || ""}>{s.notes || "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 flex-wrap">
                          {(s.photos || []).slice(0, 4).map((p: string, idx: number) => (
                            <img key={idx} src={publicUrl(p)} alt="foto" className="h-10 w-10 rounded object-cover border" />
                          ))}
                          {Array.isArray(s.photos) && s.photos.length > 4 && (
                            <span className="text-xs text-muted-foreground">+{s.photos.length - 4}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => openEdit(s)}>
                          <Pencil className="h-4 w-4 mr-2" /> Editar
                        </Button>
                        <Button size="sm" className="ml-2" onClick={() => openReport(s)}>
                          <FileText className="h-4 w-4 mr-2" /> Laudo
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Create Dialog */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar O.S</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
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
                    <Label>Tipo de Serviço</Label>
                    <Select value={newType} onValueChange={setNewType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="maintenance">Manutenção</SelectItem>
                        <SelectItem value="revision">Revisão</SelectItem>
                        <SelectItem value="spraying">Pulverização</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Data e Hora</Label>
                    <Input type="datetime-local" value={newDate} onChange={e => setNewDate(e.target.value)} />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label>Laudo (descrição)</Label>
                    <Textarea value={newNotes} onChange={e => setNewNotes(e.target.value)} />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label>Responsável</Label>
                    <div className="flex items-center gap-2">
                      <Checkbox
                          id="includeSelf"
                          checked={includeSelf}
                          onCheckedChange={(v) => setIncludeSelf(!!v)}
                          disabled={!user}
                        />
                      <label htmlFor="includeSelf" className="text-sm">
                        Adicionar o usuário que está abrindo (você)
                      </label>
                    </div>
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label>Outros usuários</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="justify-between">
                          <span className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            {assigneesSummary()}
                          </span>
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
                            const checked = selectedAssignees.includes(u.auth_user_id);
                            const initials = (u.name || u.auth_user_id || "?").split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase();
                            return (
                              <div key={u.auth_user_id} className="flex items-center gap-3 py-1">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() => toggleAssignee(u.auth_user_id)}
                                  id={`assign-${u.auth_user_id}`}
                                />
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback>{initials}</AvatarFallback>
                                </Avatar>
                                <label htmlFor={`assign-${u.auth_user_id}`} className="text-sm cursor-pointer">
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
                    <Label>Fotos</Label>
                    <div className="flex items-center gap-2">
                      <Input ref={fileInputRef} type="file" multiple accept="image/*" onChange={e => onSelectFiles(e.target.files)} />
                      <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="h-4 w-4 mr-2" /> Selecionar
                      </Button>
                    </div>
                    {newFiles.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap mt-2">
                        {newFiles.map((f, idx) => (
                          <div key={idx} className="relative">
                            <ImageIcon className="h-10 w-10 mr-1" />
                            <Button size="sm" variant="outline" onClick={() => removeNewFile(idx)}>Remover</Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <DialogFooter className="mt-4">
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                  <Button onClick={() => createMutation.mutate()} disabled={!newClientId || !newType || !newDate || createMutation.isPending}>
                    <Plus className="h-4 w-4 mr-2" /> Criar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Editar O.S</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  <div className="space-y-2">
                    <Label>Tipo de Serviço</Label>
                    <Select value={editType} onValueChange={setEditType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="maintenance">Manutenção</SelectItem>
                        <SelectItem value="revision">Revisão</SelectItem>
                        <SelectItem value="spraying">Pulverização</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Data e Hora</Label>
                    <Input type="datetime-local" value={editDate} onChange={e => setEditDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={editStatus} onValueChange={setEditStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="scheduled">Agendada</SelectItem>
                        <SelectItem value="completed">Concluída</SelectItem>
                        <SelectItem value="cancelled">Cancelada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label>Laudo (descrição)</Label>
                    <Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label>Fotos novas</Label>
                    <Input type="file" multiple accept="image/*" onChange={e => onSelectEditFiles(e.target.files)} />
                    {Array.isArray(editing?.photos) && editing.photos.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap mt-2">
                        {editing.photos.map((p: string, idx: number) => (
                          <img key={idx} src={publicUrl(p)} alt="foto" className="h-12 w-12 rounded object-cover border" />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <DialogFooter className="mt-4">
                  <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
                  <Button onClick={() => saveEditMutation.mutate()} disabled={saveEditMutation.isPending}>
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
  const pad = (n: number) => n.toString().padStart(2, "0");
  const yyyy = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
}