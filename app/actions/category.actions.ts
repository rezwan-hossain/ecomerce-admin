"use server";

import { api } from "@/lib/api";
import { CreateCategory, CreateCategoryResponse } from "@/types/category.type";

const API_URL = process.env.NEST_API_URL;

export const createCategory = async (categoryData: CreateCategory) => {
  const response = await fetch(`${API_URL}/categories`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(categoryData),
  });

  const data = await api.post<CreateCategoryResponse>(
    "/categories",
    categoryData,
  );

  if (!response.ok) {
    throw new Error("Failed to create category");
  }

  return data;
};
