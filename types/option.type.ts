export interface OptionValue {
  id: string;
  optionId: string;
  value: string;
}

export interface Option {
  id: string;
  name: string; // admin name, unique: "Shirt Size"
  displayName: string | null; // what shoppers see: "Size"
  createdAt: string;
  updatedAt: string;
  values: OptionValue[]; // included in GET /options, not in create/update responses
  _count: { productOptions: number }; // how many products use this option
}

export interface CreateOptionDto {
  name: string;
  displayName?: string | null;
}

export interface UpdateOptionDto {
  name?: string;
  displayName?: string | null; // null clears it
}

export interface CreateOptionValueDto {
  value: string;
}

export interface UpdateOptionValueDto {
  value?: string;
}
