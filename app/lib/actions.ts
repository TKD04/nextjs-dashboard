'use server';

import { signIn } from '@/auth';
import { sql } from '@vercel/postgres';
import { AuthError } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

// This is temporary until @types/react-dom is updated
export type InvoiceFormState = {
  message: string | null;
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
};

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({
    invalid_type_error: 'Please select a customer.',
  }),
  amount: z.coerce
    .number()
    .gt(0, { message: 'Please enter an amount greater than $0.' }),
  status: z.enum(['pending', 'paid'], {
    invalid_type_error: 'Please select an invoice status.',
  }),
  date: z.string(),
});
const CreateInvoiceSchema = FormSchema.omit({ id: true, date: true });
const UpdateInvoiceSchema = FormSchema.omit({ id: true, date: true });

export async function createInvoice(
  _prevState: InvoiceFormState,
  formData: FormData,
): Promise<InvoiceFormState> {
  // Validate form fields using Zod
  const validatedFields = CreateInvoiceSchema.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  // If form validation fails, return errors early. Otherwise, continue.
  if (!validatedFields.success) {
    return {
      message: 'Missing Fields. Failed to Create Invoice.',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  // Prepare data for insertion into the database
  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split('T')[0];

  // Insert data into the database
  try {
    await sql`
    INSERT INTO invoices (customer_id, amount, status, date)
    VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
  `;
  } catch (error) {
    // If a database error occurs, return a more specific error
    return {
      message: 'Database Error: Failed to Create Invoice.',
    };
  }

  // Revalidate the cache for the invoices page and redirect the user.
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export const updateInvoice = async (
  id: string,
  _prevState: InvoiceFormState,
  formData: FormData,
): Promise<InvoiceFormState> => {
  const validatedFields = UpdateInvoiceSchema.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  if (!validatedFields.success) {
    return {
      message: 'Missing Fields. Failed to Update Invoice.',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }
  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;

  try {
    await sql`
    UPDATE invoices
    SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
    WHERE id = ${id}
  `;
  } catch (error) {
    return {
      message: 'Database Error: Failed to Update Invoice.',
    };
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
};

export const deleteInvoice = async (id: string) => {
  try {
    await sql`DELETE FROM invoices WHERE id = ${id}`;
    revalidatePath('');

    return {
      message: 'Deleted Invoice.',
    };
  } catch {
    return {
      message: 'Database Error: Failed to Delete Invoice.',
    };
  }
};

export const authenticate = async (
  _prevState: string | undefined,
  formData: FormData,
): Promise<string | undefined> => {
  try {
    await signIn('credentials', formData);
    return undefined;
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Invalid credentials.';
        default:
          return 'Something went wrong.';
      }
    }
    throw error;
  }
};
