import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, inArray } from "drizzle-orm";

import {
  UserTable,
  ProductTable,
  CartTable,
  FavoriteTable,
  OrderTable,
  ShippingAddressTable,
} from "./db/schema.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

//connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

const db = drizzle(pool);

// د API routes

// 1. Health check
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    database: process.env.DATABASE_URL ? "Connected" : "Not configured",
  });
});

// 2. Get all products
app.get("/api/products", async (req, res) => {
  try {
    const allProducts = await db.select().from(ProductTable);
    res.json(allProducts);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "د محصولاتو په ترلاسه کولو کې ستونزه" });
  }
});

// 3. Insert products
app.post("/api/products", async (req, res) => {
  try {
    const newProduct = await db
      .insert(ProductTable)
      .values(req.body)
      .returning();
    res.status(201).json(newProduct);
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({ error: "not inserted" });
  }
});

// 4. Get product by ID
app.get("/api/products/:id", async (req, res) => {
  try {
    const [product] = await db
      .select()
      .from(ProductTable)
      .where(eq(ProductTable.id, req.params.id));

    if (!product) {
      return res.status(404).json({ error: "محصول ونه موندل شو" });
    }
    res.json(product);
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ error: "د محصول په ترلاسه کولو کې ستونزه" });
  }
});

// 5. Update product by ID
app.put("/api/products/:id", async (req, res) => {
  try {
    const [updatedProduct] = await db
      .update(ProductTable)
      .set(req.body)
      .where(eq(ProductTable.id, req.params.id))
      .returning();

    if (!updatedProduct) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(updatedProduct);
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ error: "Failed to update product" });
  }
});
// 6. Delete product by ID
app.delete("/api/products/:id", async (req, res) => {
  try {
    const [deletedProduct] = await db
      .delete(ProductTable)
      .where(eq(ProductTable.id, req.params.id))
      .returning();

    if (!deletedProduct) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(deletedProduct);
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

// 7. Get cart items by user ID
app.get("/api/cart/:userId", async (req, res) => {
  try {
    const userCartItems = await db
      .select()
      .from(CartTable)
      .where(eq(CartTable.userId, req.params.userId));

    const productIds = userCartItems.map((item) => item.productId);

    let productList = [];
    if (productIds.length > 0) {
      productList = await db
        .select()
        .from(ProductTable)
        .where(inArray(ProductTable.id, productIds));
    }

    const itemsWithProducts = userCartItems.map((cartItem) => {
      const product = productList.find((p) => p.id === cartItem.productId);
      return {
        ...cartItem,
        product: product || cartItem.productData,
      };
    });

    const totalItems = userCartItems.reduce(
      (sum, item) => sum + item.quantity,
      0
    );

    const totalPrice =
      itemsWithProducts.reduce((sum, item) => {
        const price = item.product?.priceInCents || 0;
        return sum + price * item.quantity;
      }, 0) / 100;

    res.json({
      items: itemsWithProducts,
      totalItems,
      totalPrice,
    });
  } catch (error) {
    console.error("Error fetching cart:", error);
    res.status(500).json({ error: "not found card" });
  }
});

app.post("/api/cart/:userId/add", async (req, res) => {
  try {
    const { product, quantity = 1 } = req.body;

    if (!product || !product.id) {
      return res
        .status(400)
        .json({ error: "Product information is incomplete" });
    }

    const [existingItem] = await db
      .select()
      .from(CartTable)
      .where(
        and(
          eq(CartTable.userId, req.params.userId),
          eq(CartTable.productId, product.id)
        )
      );

    let result;
    if (existingItem) {
      [result] = await db
        .update(CartTable)
        .set({
          quantity: existingItem.quantity + quantity,
          updatedAt: new Date(),
          productData: product,
        })
        .where(eq(CartTable.id, existingItem.id))
        .returning();
    } else {
      [result] = await db
        .insert(CartTable)
        .values({
          userId: req.params.userId,
          productId: product.id,
          quantity,
          productData: product,
        })
        .returning();
    }

    res.json(result);
  } catch (error) {
    console.error("Error adding to cart:", error);
    res.status(500).json({ error: "Failed to add item to cart" });
  }
});

app.put("/api/cart/:userId/update", async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    if (!productId || quantity === undefined) {
      return res.status(400).json({ error: "Incomplete information" });
    }
    if (quantity <= 0) {
      await db
        .delete(CartTable)
        .where(
          and(
            eq(CartTable.userId, req.params.userId),
            eq(CartTable.productId, productId)
          )
        );
      return res.json({ success: true, message: "Item removed from cart" });
    }

    const [result] = await db
      .update(CartTable)
      .set({
        quantity,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(CartTable.userId, req.params.userId),
          eq(CartTable.productId, productId)
        )
      )
      .returning();

    if (!result) {
      return res.status(404).json({ error: "Cart item not found" });
    }

    res.json({ success: true, item: result });
  } catch (error) {
    console.error("Error updating cart:", error);
    res.status(500).json({ error: "Error updating cart" });
  }
});

app.delete("/api/cart/:userId/remove/:productId", async (req, res) => {
  try {
    await db
      .delete(CartTable)
      .where(
        and(
          eq(CartTable.userId, req.params.userId),
          eq(CartTable.productId, req.params.productId)
        )
      );
    res.json({ success: true });
  } catch (error) {
    console.error("Error removing from cart:", error);
    res.status(500).json({ error: "Error removing from cart item" });
  }
});

app.delete("/api/cart/:userId/clear", async (req, res) => {
  try {
    await db.delete(CartTable).where(eq(CartTable.userId, req.params.userId));
    res.json({ success: true });
  } catch (error) {
    console.error("Error clearing cart:", error);
    res.status(500).json({ error: "Error clearing cart" });
  }
});

app.get("/api/cart/:userId/count", async (req, res) => {
  try {
    const userCartItems = await db
      .select()
      .from(CartTable)
      .where(eq(CartTable.userId, req.params.userId));

    const totalItems = userCartItems.reduce(
      (sum, item) => sum + item.quantity,
      0
    );
    res.json({ count: totalItems });
  } catch (error) {
    console.error("Error getting cart count:", error);
    res.status(500).json({ error: "Error getting cart count" });
  }
});

// 4. favorites APIs
app.get("/api/favorites/:userId", async (req, res) => {
  try {
    const userFavorites = await db
      .select()
      .from(FavoriteTable)
      .where(eq(FavoriteTable.userId, req.params.userId));

    const productIds = userFavorites.map((fav) => fav.productId);

    let productList = [];
    if (productIds.length > 0) {
      productList = await db
        .select()
        .from(ProductTable)
        .where(inArray(ProductTable.id, productIds));
    }

    const favoritesWithProducts = userFavorites.map((favorite) => {
      const product = productList.find((p) => p.id === favorite.productId);
      return {
        ...favorite,
        product: product || favorite.productData,
      };
    });

    res.json({
      items: favoritesWithProducts,
      totalFavorites: userFavorites.length,
    });
  } catch (error) {
    console.error("Error fetching favorites:", error);
    res.status(500).json({ error: "Error fetching favorites" });
  }
});

app.post("/api/favorites/:userId/add", async (req, res) => {
  try {
    const { product } = req.body;

    if (!product || !product.id) {
      return res
        .status(400)
        .json({ error: "Product information is incomplete" });
    }

    const [existing] = await db
      .select()
      .from(FavoriteTable)
      .where(
        and(
          eq(FavoriteTable.userId, req.params.userId),
          eq(FavoriteTable.productId, product.id)
        )
      );

    let result;
    if (!existing) {
      [result] = await db
        .insert(FavoriteTable)
        .values({
          userId: req.params.userId,
          productId: product.id,
          productData: product,
        })
        .returning();
    } else {
      result = existing;
    }

    res.json(result);
  } catch (error) {
    console.error("Error adding to favorites:", error);
    res.status(500).json({ error: "Error adding to favorites" });
  }
});

app.delete("/api/favorites/:userId/remove/:productId", async (req, res) => {
  try {
    await db
      .delete(FavoriteTable)
      .where(
        and(
          eq(FavoriteTable.userId, req.params.userId),
          eq(FavoriteTable.productId, req.params.productId)
        )
      );
    res.json({ success: true });
  } catch (error) {
    console.error("Error removing from favorites:", error);
    res.status(500).json({ error: "Error removing from favorites" });
  }
});

app.get("/api/favorites/:userId/check/:productId", async (req, res) => {
  try {
    const [result] = await db
      .select()
      .from(FavoriteTable)
      .where(
        and(
          eq(FavoriteTable.userId, req.params.userId),
          eq(FavoriteTable.productId, req.params.productId)
        )
      );

    res.json({ isFavorite: !!result });
  } catch (error) {
    console.error("Error checking favorite:", error);
    res.status(500).json({ error: "Error checking favorite" });
  }
});

// 5. د orders APIs
app.post("/api/orders", async (req, res) => {
  try {
    const { userId, items, shippingAddress, totalAmount } = req.body;

    if (!userId || !items || !shippingAddress || !totalAmount) {
      return res.status(400).json({ error: "Incomplete information" });
    }

    const createdOrders = [];
    for (const item of items) {
      const [order] = await db
        .insert(OrderTable)
        .values({
          userId,
          productId: item.productId,
          quantity: item.quantity,
          shippingAddressId: shippingAddress.id,
          pricePaidInCents: item.price * item.quantity * 100,
          paymentIntentId: `pi_${Date.now()}_${Math.random()
            .toString(36)
            .substr(2, 9)}`,
          status: "PROCESSING",
        })
        .returning();

      if (order) {
        createdOrders.push(order);

        // د محصول د stock quantity تازه کول
        const [product] = await db
          .select()
          .from(ProductTable)
          .where(eq(ProductTable.id, item.productId));

        if (product) {
          await db
            .update(ProductTable)
            .set({
              stockQuantity: product.stockQuantity - item.quantity,
              updatedAt: new Date(),
            })
            .where(eq(ProductTable.id, item.productId));
        }
      }
    }

    // که order په بریالیتوب سره ثبت شو، کارت پاک کړئ
    if (createdOrders.length > 0) {
      await db.delete(CartTable).where(eq(CartTable.userId, userId));
    }

    res.status(201).json({ success: true, orders: createdOrders });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ error: "Error creating order" });
  }
});

app.get("/api/orders/:userId", async (req, res) => {
  try {
    const userOrders = await db
      .select()
      .from(OrderTable)
      .where(eq(OrderTable.userId, req.params.userId));

    const productIds = userOrders.map((order) => order.productId);
    const addressIds = userOrders.map((order) => order.shippingAddressId);

    let productList = [];
    let addressList = [];

    if (productIds.length > 0) {
      productList = await db
        .select()
        .from(ProductTable)
        .where(inArray(ProductTable.id, productIds));
    }

    if (addressIds.length > 0) {
      addressList = await db
        .select()
        .from(ShippingAddressTable)
        .where(inArray(ShippingAddressTable.id, addressIds));
    }

    const ordersWithDetails = userOrders.map((order) => {
      const product = productList.find((p) => p.id === order.productId);
      const address = addressList.find((a) => a.id === order.shippingAddressId);

      return {
        ...order,
        product: product || null,
        shippingAddress: address || null,
      };
    });

    res.json(ordersWithDetails);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ error: "Error fetching orders" });
  }
});

// 6. د shipping addresses APIs
app.get("/api/addresses/:userId", async (req, res) => {
  try {
    const userAddresses = await db
      .select()
      .from(ShippingAddressTable)
      .where(eq(ShippingAddressTable.userId, req.params.userId));

    res.json(userAddresses);
  } catch (error) {
    console.error("Error fetching addresses:", error);
    res.status(500).json({ error: "Error fetching addresses" });
  }
});

app.post("/api/addresses/:userId/add", async (req, res) => {
  try {
    const { fullName, country, province, city, address, phoneNumber } =
      req.body;

    if (
      !fullName ||
      !country ||
      !province ||
      !city ||
      !address ||
      !phoneNumber
    ) {
      return res.status(400).json({ error: "Incomplete information" });
    }

    const [newAddress] = await db
      .insert(ShippingAddressTable)
      .values({
        userId: req.params.userId,
        fullName,
        country,
        province,
        city,
        address,
        phoneNumber,
      })
      .returning();

    res.status(201).json(newAddress);
  } catch (error) {
    console.error("Error adding address:", error);
    res.status(500).json({ error: "Error adding address" });
  }
});

// 7. د users APIs
app.get("/api/users/:id", async (req, res) => {
  try {
    const [user] = await db
      .select()
      .from(UserTable)
      .where(eq(UserTable.id, req.params.id));

    if (!user) {
      return res.status(404).json({ error: "user not found" });
    }

    // د کارن له کارت څخه د توکو شمیر
    const userCartItems = await db
      .select()
      .from(CartTable)
      .where(eq(CartTable.userId, req.params.id));

    const cartCount = userCartItems.reduce(
      (sum, item) => sum + item.quantity,
      0
    );

    // د کارن favorites شمیر
    const userFavorites = await db
      .select()
      .from(FavoriteTable)
      .where(eq(FavoriteTable.userId, req.params.id));

    // د کارن orders شمیر
    const userOrders = await db
      .select()
      .from(OrderTable)
      .where(eq(OrderTable.userId, req.params.id));

    res.json({
      ...user,
      stats: {
        cartCount,
        favoritesCount: userFavorites.length,
        ordersCount: userOrders.length,
      },
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Error fetching user" });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// د server پیلول
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
});

export default app;
