"use server";

import { handleRequest } from "@/lib/action-response";
import { api } from "@/lib/api";
import { Brand, CreateBrandDto } from "@/types/brand.type";

export async function getBrands() {
  return handleRequest(async () => {
    const res = await api.get<{ data: Brand[] }>("/brands?limit=100");
    return res.data;
  });
}

export async function createBrand(data: CreateBrandDto) {
  return handleRequest(async () => {
    const res = await api.post<{ data: Brand }>("/brands", data);
    return res.data;
  });
}

export async function updateBrand(id: string, data: Partial<CreateBrandDto>) {
  return handleRequest(async () => {
    const res = await api.patch<{ data: Brand }>(`/brands/${id}`, data);
    return res.data;
  });
}

export async function deleteBrand(id: string) {
  return handleRequest(async () => {
    await api.delete(`/brands/${id}`);
    return true;
  });
}
