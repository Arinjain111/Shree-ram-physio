const { z } = require('zod');

const InvoiceDataSchema = z.object({
  paymentMethod: z.string().default('Cash'),
});

console.log(InvoiceDataSchema.safeParse({ paymentMethod: 'UPI' }).data);
console.log(InvoiceDataSchema.safeParse({ paymentMethod: undefined }).data);
console.log(InvoiceDataSchema.safeParse({ paymentMethod: null }).data);
