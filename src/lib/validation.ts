import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email é obrigatório')
    .email('Email inválido')
    .max(255, 'Email muito longo'),
  password: z
    .string()
    .min(6, 'Senha deve ter no mínimo 6 caracteres')
    .max(100, 'Senha muito longa'),
});

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(100, 'Nome muito longo'),
  email: z
    .string()
    .trim()
    .min(1, 'Email é obrigatório')
    .email('Email inválido')
    .max(255, 'Email muito longo'),
  password: z
    .string()
    .min(6, 'Senha deve ter no mínimo 6 caracteres')
    .max(100, 'Senha muito longa'),
});

export const productSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nome é obrigatório')
    .max(200, 'Nome muito longo'),
  sku: z
    .string()
    .trim()
    .max(50, 'SKU muito longo')
    .optional(),
  category: z
    .string()
    .trim()
    .max(100, 'Categoria muito longa')
    .optional(),
  description: z
    .string()
    .trim()
    .max(1000, 'Descrição muito longa')
    .optional(),
  cost: z
    .number()
    .positive('Custo deve ser maior que zero')
    .max(999999999, 'Custo muito alto'),
  price: z
    .number()
    .positive('Preço deve ser maior que zero')
    .max(999999999, 'Preço muito alto'),
  stock: z
    .number()
    .int('Estoque deve ser um número inteiro')
    .min(0, 'Estoque não pode ser negativo')
    .max(999999999, 'Estoque muito alto'),
  low_stock_threshold: z
    .number()
    .int('Limite de estoque baixo deve ser um número inteiro')
    .min(0, 'Limite não pode ser negativo')
    .max(999999, 'Limite muito alto'),
  max_discount_percent: z
    .number()
    .min(0, 'Desconto máximo não pode ser negativo')
    .max(100, 'Desconto máximo não pode ser maior que 100%'),
  profit_margin_percent: z
    .number()
    .min(0, 'Margem de lucro não pode ser negativa')
    .max(1000, 'Margem de lucro muito alta'),
  tax_percent: z
    .number()
    .min(0, 'Imposto não pode ser negativo')
    .max(100, 'Imposto não pode ser maior que 100%'),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type ProductFormData = z.infer<typeof productSchema>;
