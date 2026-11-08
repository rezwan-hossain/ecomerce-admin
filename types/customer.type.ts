// A customer account: the backend's User with role CUSTOMER. Dates are ISO strings.
export interface CustomerAccount {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  birthDate: string | null;
  gender: string | null;
  image: string | null;
  isActive: boolean;
  createdAt: string;
}

// What POST /users takes; blanks are left out.
export interface CreateCustomerBody {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  birthDate?: string;
  gender?: string;
  image?: string;
  isActive: boolean;
}
