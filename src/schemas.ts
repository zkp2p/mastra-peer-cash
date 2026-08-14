import { z } from "zod";

export const positiveIntegerStringSchema = z
  .string()
  .regex(/^0*[1-9][0-9]*$/, "Amount must be a positive base-unit integer string");

export const addressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Expected an EVM address");
export const hashSchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Expected a transaction hash");
export const depositIdSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}_[0-9]+$/, "Expected a Peer composite deposit id");

const payeeSchema = z.union([
  z.string().min(1),
  z.object({ offchainId: z.string().min(1) }).passthrough(),
]);

const singleCurrencyLegSchema = z
  .object({
    platform: z.string().min(1),
    currency: z.string().min(3),
    payee: payeeSchema,
  })
  .strict();

const multiCurrencyLegSchema = z
  .object({
    platform: z.string().min(1),
    currencies: z.array(z.string().min(3)).min(1),
    payee: payeeSchema,
  })
  .strict();

export const receiveLegSchema = z.union([singleCurrencyLegSchema, multiCurrencyLegSchema]);
export const receiveSchema = z.union([receiveLegSchema, z.array(receiveLegSchema).min(1)]);

export const preparedTransactionSchema = z.object({
  to: addressSchema,
  data: z.string().regex(/^0x[0-9a-fA-F]*$/),
  value: z.string().regex(/^[0-9]+$/),
  chainId: z.number().int().positive(),
});

export const preparedStepSchema = z.object({
  kind: z.string(),
  description: z.string(),
});

export const preparedPlanSchema = z.object({
  txs: z.array(preparedTransactionSchema),
  steps: z.array(preparedStepSchema),
  accessPolicyRequired: z.boolean().optional(),
  register: z.unknown().optional(),
});

export const capabilitiesOutputSchema = z
  .object({
    chainId: z.number().int(),
    token: z.object({
      address: addressSchema,
      symbol: z.string(),
      decimals: z.number().int(),
    }),
    environment: z.string(),
    platforms: z.array(
      z
        .object({
          platform: z.string(),
          currencies: z.array(z.string()),
          payeeHint: z.string(),
          requiresIdentityAttestation: z.boolean(),
          requiresAtomicAccessPolicy: z.boolean(),
        })
        .passthrough(),
    ),
    currencies: z.array(z.string()),
    amount: z.object({
      min: z.string(),
      recommendedMin: z.string(),
      max: z.string().nullable(),
    }),
    pricing: z.object({
      kind: z.string(),
      spreadBps: z.number(),
    }),
  })
  .passthrough();

export const estimateOutputSchema = z
  .object({
    kind: z.literal("oracle-estimate"),
    currency: z.string(),
    amount: z.string(),
    rate: z.number(),
    receiveAmount: z.number(),
    asOf: z.number(),
    oracleUpdatedAt: z.number().optional(),
    eta: z.object({ seconds: z.number().optional(), label: z.string() }).optional(),
  })
  .passthrough();

export const orderOutputSchema = z
  .object({
    depositId: depositIdSchema,
    state: z.string(),
    nextActions: z.array(z.string()),
  })
  .passthrough();

export const finalizeOutputSchema = z
  .object({
    depositId: depositIdSchema,
    txHash: hashSchema,
    escrowAddress: addressSchema,
    onchainDepositId: z.string().regex(/^[0-9]+$/),
    order: orderOutputSchema,
  })
  .passthrough();
