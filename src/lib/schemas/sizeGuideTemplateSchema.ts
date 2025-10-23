import { z } from 'zod';

type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export interface JsonObject extends Record<string, JsonValue> {}
export interface JsonArray extends Array<JsonValue> {}

const guideDataFormSchema = z.object({
  headers: z.array(z.object({ value: z.string().min(1, 'Header cannot be empty') })),
  rows: z.array(z.array(z.string())),
});

const guideDataStorageSchema = z.object({
  headers: z.array(z.string().min(1, 'Header cannot be empty')),
  rows: z.array(z.array(z.string())),
});

export const sizeGuideTemplateFormSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  guide_data: guideDataFormSchema,
});

export const sizeGuideTemplateStorageSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  guide_data: guideDataStorageSchema,
});

export type SizeGuideTemplateFormData = z.infer<typeof sizeGuideTemplateFormSchema>;

export type SizeGuideTemplate = {
  id: string;
  name: string;
  guide_data: any; 
  created_at: string;
  updated_at: string;
}; 