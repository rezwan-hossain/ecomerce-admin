export interface TemplateOptionValue {
  id: string;
  templateOptionId: string;
  optionValueId: string;
  optionValue: { id: string; value: string };
}

export interface TemplateOption {
  id: string;
  templateId: string;
  optionId: string;
  option: { id: string; name: string };
  values: TemplateOptionValue[];
}

export interface VariantTemplate {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  options: TemplateOption[];
}

export interface CreateVariantTemplateDto {
  name: string;
  description?: string;
  options: { optionId: string; optionValueIds: string[] }[];
}

// Sending `options` replaces all of the template's options.
export type UpdateVariantTemplateDto = Partial<CreateVariantTemplateDto>;
