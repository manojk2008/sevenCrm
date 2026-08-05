"use client";

import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

const productSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  category: z.string().min(1, 'Category is required'),
  description: z.string().optional(),
  price: z.coerce.number().min(0, 'Price must be positive'),
  stock: z.coerce.number().min(0, 'Stock must be positive'),
  unit: z.string().min(1, 'Unit is required'),
  sku: z.string().optional(),
  hsnCode: z.string().optional(),
  gstRate: z.string().min(1, 'GST Rate is required'),
  status: z.boolean().default(true),
  specifications: z.array(z.object({
    key: z.string().min(1, 'Key is required'),
    value: z.string().min(1, 'Value is required')
  }))
});

type ProductFormValues = z.infer<typeof productSchema>;

interface ProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: any | null;
}

export function ProductForm({ open, onOpenChange, product }: ProductFormProps) {
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: product ? {
      ...product,
      status: product.status === 'Active',
      gstRate: product.gstRate.toString(),
      specifications: []
    } : {
      name: '',
      category: '',
      description: '',
      price: 0,
      stock: 0,
      unit: 'Per License',
      sku: `SKU-${Math.floor(Math.random() * 10000)}`,
      hsnCode: '',
      gstRate: '18',
      status: true,
      specifications: []
    }
  });

  const { fields, append, remove } = useFieldArray({
    name: "specifications",
    control: form.control
  });

  const onSubmit = (data: ProductFormValues) => {
    toast.success(`Product ${product ? 'updated' : 'created'} successfully!`);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl w-full overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>{product ? 'Edit Product' : 'Add New Product'}</SheetTitle>
          <SheetDescription>
            {product ? 'Make changes to your product here.' : 'Add a new product to your catalog.'}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="col-span-1 md:col-span-2">
                    <FormLabel>Product Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enterprise Software License" {...field} className="rounded-xl" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Software">Software</SelectItem>
                        <SelectItem value="Service">Service</SelectItem>
                        <SelectItem value="Hardware">Hardware</SelectItem>
                        <SelectItem value="Subscription">Subscription</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Per License">Per License</SelectItem>
                        <SelectItem value="Per User">Per User</SelectItem>
                        <SelectItem value="Per Month">Per Month</SelectItem>
                        <SelectItem value="Per Year">Per Year</SelectItem>
                        <SelectItem value="One-time">One-time</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price (₹) *</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0.00" {...field} className="rounded-xl" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="stock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stock *</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0" {...field} className="rounded-xl" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="gstRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GST Rate *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Select GST" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="0">0%</SelectItem>
                        <SelectItem value="5">5%</SelectItem>
                        <SelectItem value="12">12%</SelectItem>
                        <SelectItem value="18">18%</SelectItem>
                        <SelectItem value="28">28%</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU</FormLabel>
                    <FormControl>
                      <Input placeholder="Auto-generated" {...field} className="rounded-xl" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="col-span-1 md:col-span-2">
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Detailed product description..." 
                        className="resize-none rounded-xl" 
                        rows={3}
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 p-4 col-span-1 md:col-span-2">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active Status</FormLabel>
                      <div className="text-sm text-slate-500">
                        {field.value ? 'Product is visible and available for sale.' : 'Product is hidden.'}
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Specifications</h4>
                <Button type="button" variant="outline" size="sm" onClick={() => append({ key: '', value: '' })} className="rounded-xl h-8">
                  <Plus className="mr-2 h-3.5 w-3.5" /> Add Row
                </Button>
              </div>
              
              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-2 items-start">
                  <FormField
                    control={form.control}
                    name={`specifications.${index}.key`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input placeholder="e.g. Memory" {...field} className="rounded-xl" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`specifications.${index}.value`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input placeholder="e.g. 16GB" {...field} className="rounded-xl" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="text-red-500 flex-shrink-0 h-10 w-10">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {fields.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  No specifications added. Click 'Add Row' to define product details.
                </p>
              )}
            </div>

            <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl">
                {product ? 'Save Changes' : 'Create Product'}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
