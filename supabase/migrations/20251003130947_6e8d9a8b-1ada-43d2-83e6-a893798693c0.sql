-- Adicionar política para permitir vendedores criarem demonstrações
CREATE POLICY "demo_seller_insert" 
ON demonstrations 
FOR INSERT 
TO authenticated
WITH CHECK (
  client_id IN (
    SELECT c.id 
    FROM clients c 
    WHERE c.seller_auth_id = auth.uid()
  )
);

-- Adicionar política para permitir vendedores atualizarem suas demonstrações
CREATE POLICY "demo_seller_update" 
ON demonstrations 
FOR UPDATE 
TO authenticated
USING (
  client_id IN (
    SELECT c.id 
    FROM clients c 
    WHERE c.seller_auth_id = auth.uid()
  ) 
  OR auth.uid() = ANY (assigned_users)
)
WITH CHECK (
  client_id IN (
    SELECT c.id 
    FROM clients c 
    WHERE c.seller_auth_id = auth.uid()
  )
);

-- Adicionar política para permitir vendedores deletarem suas demonstrações
CREATE POLICY "demo_seller_delete" 
ON demonstrations 
FOR DELETE 
TO authenticated
USING (
  client_id IN (
    SELECT c.id 
    FROM clients c 
    WHERE c.seller_auth_id = auth.uid()
  )
);