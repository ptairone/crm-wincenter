import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ClientAutocomplete } from "@/components/ClientAutocomplete";
import { X as XIcon } from "lucide-react";

interface Product {
  id: string;
  name: string;
  category?: string | null;
}

export default function Warranties() {
  const { user, userRole } = useAuth();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);

  const [clientId, setClientId] = useState<string>("");
  const [selectedProductToAdd, setSelectedProductToAdd] = useState<string>("");
  const [selectedProducts, setSelectedProducts] = useState<{ name: string; quantity: number }[]>([]);
  const [serviceType, setServiceType] = useState<"maintenance" | "revision" | "spraying">("maintenance");
  const [reportedDefect, setReportedDefect] = useState<string>("");
  const [solutionPresented, setSolutionPresented] = useState<string>("");
  const [attachments, setAttachments] = useState<File[]>([]);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, category, status")
        .eq("status", "active")
        .order("name");

      if (error) throw error;
      setProducts((data || []).map((p: any) => ({ id: p.id, name: p.name, category: p.category })));
    } catch (err) {
      console.error("Erro ao carregar produtos:", err);
      toast.error("Erro ao carregar produtos");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments(files);
  };

  const addProduct = () => {
    if (!selectedProductToAdd) return;
    if (!selectedProducts.find((p) => p.name === selectedProductToAdd)) {
      setSelectedProducts([...selectedProducts, { name: selectedProductToAdd, quantity: 1 }]);
    }
    setSelectedProductToAdd("");
  };

  const removeProduct = (name: string) => {
    setSelectedProducts(selectedProducts.filter((p) => p.name !== name));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientId) {
      toast.error("Selecione um cliente");
      return;
    }
    if (selectedProducts.length === 0) {
      toast.error("Selecione ao menos um produto");
      return;
    }
    if (selectedProducts.some((p) => !p.quantity || p.quantity < 1)) {
      toast.error("Defina quantidade válida para todos os produtos");
      return;
    }
    if (!reportedDefect.trim()) {
      toast.error("Informe o defeito relatado");
      return;
    }

    setLoading(true);
    try {
      const combinedNotes = [
        serviceType === "maintenance" ? "Garantia: Sim" : "Garantia: Não",
        `Produtos: ${selectedProducts.map((p) => `${p.name} (qtd: ${p.quantity})`).join(", ")}`,
        `Defeito: ${reportedDefect}`,
        solutionPresented ? `Solução: ${solutionPresented}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      const serviceData: any = {
        client_id: clientId,
        assigned_users: user?.id ? [user.id] : [],
        service_type: serviceType,
        date: new Date().toISOString(),
        status: "scheduled",
        notes: combinedNotes || null,
        created_by: user?.id || null,
      };

      const { error } = await supabase.from("services").insert([serviceData]);
      if (error) throw error;

      toast.success("Garantia registrada com sucesso!");
      setClientId("");
      setSelectedProducts([]);
      setSelectedProductToAdd("");
      setServiceType("maintenance");
      setReportedDefect("");
      setSolutionPresented("");
      setAttachments([]);
    } catch (err: any) {
      console.error("Erro ao salvar garantia:", err);
      toast.error(err.message || "Erro ao salvar garantia");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="container max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Garantias</h1>
          <p className="text-muted-foreground">Registro de serviços em garantia</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Novo Registro de Garantia</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome do Cliente *</Label>
                  <ClientAutocomplete value={clientId} onChange={setClientId} userRole={userRole} userId={user?.id} />
                </div>

                <div className="space-y-2">
                  <Label>Serviço *</Label>
                  <Select value={serviceType} onValueChange={(v) => setServiceType(v as any)}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Selecione o serviço" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-[100]">
                      <SelectItem value="maintenance">Manutenção</SelectItem>
                      <SelectItem value="revision">Revisão</SelectItem>
                      <SelectItem value="spraying">Pulverização</SelectItem>
                    </SelectContent>
                  </Select>
                  {serviceType === "maintenance" && (
                    <p className="text-xs text-muted-foreground">Este registro será marcado como garantia.</p>
                  )}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Produto(s) *</Label>
                  <div className="flex gap-2">
                    <Select value={selectedProductToAdd} onValueChange={setSelectedProductToAdd}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Selecione um produto" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-[100] max-h-64">
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.name}>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{p.name}</span>
                              {p.category && (
                                <span className="text-xs text-muted-foreground">({p.category})</span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      onClick={addProduct}
                      disabled={!selectedProductToAdd || selectedProducts.some((p) => p.name === selectedProductToAdd)}
                    >
                      Adicionar
                    </Button>
                  </div>
                  {selectedProducts.length > 0 && (
                    <div className="space-y-2 mt-2">
                      {selectedProducts.map((item, idx) => (
                        <div className="flex items-center gap-2" key={item.name}>
                          <Badge variant="secondary">{item.name}</Badge>
                          <Input
                            type="number"
                            min={1}
                            step={1}
                            className="w-20"
                            value={item.quantity}
                            onChange={(e) => {
                              const qty = Math.max(1, parseInt(e.target.value || "1", 10));
                              const next = [...selectedProducts];
                              next[idx] = { ...item, quantity: qty };
                              setSelectedProducts(next);
                            }}
                          />
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeProduct(item.name)}>
                            Remover
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Fotos e Arquivos</Label>
                  <Input type="file" multiple onChange={handleFileChange} />
                  {attachments.length > 0 && (
                    <div className="mt-2 text-sm text-muted-foreground">{attachments.length} arquivo(s) selecionado(s)</div>
                  )}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Defeito Relatado *</Label>
                  <Textarea
                    value={reportedDefect}
                    onChange={(e) => setReportedDefect(e.target.value)}
                    placeholder="Descreva o defeito observado"
                    className="min-h-[100px]"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Solução Apresentada</Label>
                  <Textarea
                    value={solutionPresented}
                    onChange={(e) => setSolutionPresented(e.target.value)}
                    placeholder="Descreva a solução apresentada ao cliente"
                    className="min-h-[100px]"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={loading}>
                  {loading ? "Salvando..." : "Salvar Garantia"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}