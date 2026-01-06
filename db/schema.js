import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const createdAt = timestamp({ withTimezone: true }).defaultNow();
const updatedAt = timestamp({ withTimezone: true })
  .defaultNow()
  .$onUpdate(() => new Date());

const id = uuid().primaryKey().defaultRandom();

export const UserRole = pgEnum("user_role", ["USER", "ADMIN"]);
export const OrderStatus = pgEnum("order_status", [
  "PROCESSING",
  "SHIPPING",
  "DELIVERED",
]);

export const UserTable = pgTable("users", {
  id: text().primaryKey(),
  name: varchar().notNull(),
  email: text().notNull().unique(),
  imageUrl: text(),
  role: UserRole(),
  createdAt: createdAt,
  updatedAt: updatedAt,
});

export const UserRelations = relations(UserTable, ({ many }) => {
  return {
    products: many(ProductTable),
    orders: many(OrderTable),
    shippingAddress: many(ShippingAddressTable),
    cartItems: many(CartTable),
    favorites: many(FavoriteTable),
  };
});

export const ProductTable = pgTable("products", {
  id: id,
  name: text().notNull(),
  description: text(),
  imageUrl: text().notNull(),
  userId: text()
    .notNull()
    .references(() => UserTable.id, { onDelete: "restrict" }),
  priceInCents: integer().notNull(),
  availableForPurchase: boolean().notNull().default(false),
  weight: text().notNull(),
  stockQuantity: integer().notNull().default(0),
  category: varchar({ length: 100 }),
  createdAt: createdAt,
  updatedAt: updatedAt,
});

export const ProductRelations = relations(ProductTable, ({ one, many }) => {
  return {
    user: one(UserTable, {
      fields: [ProductTable.userId],
      references: [UserTable.id],
    }),
    orders: many(OrderTable),
    cartItems: many(CartTable),
    favorites: many(FavoriteTable),
  };
});

export const CartTable = pgTable("cart_items", {
  id: id,
  userId: text()
    .notNull()
    .references(() => UserTable.id, { onDelete: "cascade" }),
  productId: uuid()
    .notNull()
    .references(() => ProductTable.id, { onDelete: "cascade" }),
  quantity: integer().notNull().default(1),

  productData: jsonb().notNull(),
  createdAt: createdAt,
  updatedAt: updatedAt,
});

export const CartRelations = relations(CartTable, ({ one }) => {
  return {
    user: one(UserTable, {
      fields: [CartTable.userId],
      references: [UserTable.id],
    }),
    product: one(ProductTable, {
      fields: [CartTable.productId],
      references: [ProductTable.id],
    }),
  };
});

export const FavoriteTable = pgTable("favorites", {
  id: id,
  userId: text()
    .notNull()
    .references(() => UserTable.id, { onDelete: "cascade" }),
  productId: uuid()
    .notNull()
    .references(() => ProductTable.id, { onDelete: "cascade" }),

  productData: jsonb().notNull(),
  createdAt: createdAt,
});

export const FavoriteRelations = relations(FavoriteTable, ({ one }) => {
  return {
    user: one(UserTable, {
      fields: [FavoriteTable.userId],
      references: [UserTable.id],
    }),
    product: one(ProductTable, {
      fields: [FavoriteTable.productId],
      references: [ProductTable.id],
    }),
  };
});

export const OrderTable = pgTable("orders", {
  id: id,
  userId: text()
    .notNull()
    .references(() => UserTable.id, { onDelete: "restrict" }),
  productId: uuid()
    .notNull()
    .references(() => ProductTable.id, { onDelete: "restrict" }),
  shippingAddressId: uuid()
    .notNull()
    .references(() => ShippingAddressTable.id, { onDelete: "cascade" }),
  pricePaidInCents: integer().notNull(),
  paymentIntentId: text().notNull(),
  status: OrderStatus().default("PROCESSING"),
  quantity: integer().notNull().default(1),
  createdAt: createdAt,
  updatedAt: updatedAt,
});

export const OrderRelations = relations(OrderTable, ({ one }) => {
  return {
    user: one(UserTable, {
      fields: [OrderTable.userId],
      references: [UserTable.id],
    }),
    product: one(ProductTable, {
      fields: [OrderTable.productId],
      references: [ProductTable.id],
    }),
    shippingAddress: one(ShippingAddressTable, {
      fields: [OrderTable.shippingAddressId],
      references: [ShippingAddressTable.id],
    }),
  };
});

export const ShippingAddressTable = pgTable("shipping_address", {
  id: id,
  userId: text()
    .notNull()
    .references(() => UserTable.id, { onDelete: "cascade" }),
  fullName: varchar().notNull(),
  country: varchar().notNull(),
  province: varchar().notNull(),
  city: varchar().notNull(),
  address: text().notNull(),
  phoneNumber: text().notNull(),
  createdAt: createdAt,
  updatedAt: updatedAt,
});

export const ShippingAddressRelations = relations(
  ShippingAddressTable,
  ({ one, many }) => {
    return {
      user: one(UserTable, {
        fields: [ShippingAddressTable.userId],
        references: [UserTable.id],
      }),
      orders: many(OrderTable),
    };
  }
);
