CREATE TABLE "AuditLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "entityType" TEXT NOT NULL,
    "entityId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "operator" TEXT NOT NULL DEFAULT 'SYSTEM',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "ExchangeNewItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "exchangeId" INTEGER NOT NULL,
    "productName" TEXT NOT NULL,
    "weight" INTEGER,
    "salePrice" INTEGER NOT NULL,
    "laborFeeItem" INTEGER NOT NULL,
    CONSTRAINT "ExchangeNewItem_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "ExchangeOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ExchangeOldItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "exchangeId" INTEGER NOT NULL,
    "inventoryItemId" INTEGER NOT NULL,
    "deductAmount" INTEGER NOT NULL,
    "costAmount" INTEGER NOT NULL,
    "costPureWeight" INTEGER NOT NULL,
    CONSTRAINT "ExchangeOldItem_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "ExchangeOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExchangeOldItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ExchangeOrder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderNo" TEXT NOT NULL,
    "partyId" INTEGER,
    "totalOldDeduct" INTEGER NOT NULL,
    "totalNewPrice" INTEGER NOT NULL,
    "laborFee" INTEGER NOT NULL,
    "receiveAmount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExchangeOrder_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "GoldPrice" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "internationalPrice" INTEGER NOT NULL,
    "rongtongjinPrice" INTEGER NOT NULL,
    "recyclePrice" INTEGER NOT NULL,
    "salePrice" INTEGER NOT NULL,
    "silverRecyclePrice" INTEGER NOT NULL DEFAULT 0,
    "silverSalePrice" INTEGER NOT NULL DEFAULT 0,
    "silverMarketPrice" INTEGER NOT NULL DEFAULT 0,
    "platinumRecyclePrice" INTEGER NOT NULL DEFAULT 0,
    "platinumSalePrice" INTEGER NOT NULL DEFAULT 0,
    "platinumMarketPrice" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "InventoryItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uniqueCode" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "itemName" TEXT NOT NULL,
    "metalType" TEXT NOT NULL DEFAULT 'GOLD',
    "grossWeight" INTEGER NOT NULL,
    "purity" INTEGER NOT NULL,
    "pureWeight" INTEGER NOT NULL,
    "costAmount" INTEGER NOT NULL,
    "costPureWeight" INTEGER NOT NULL,
    "recyclePriceAtReceive" INTEGER,
    "rongtongjinPriceAtReceive" INTEGER,
    "internationalPriceAtReceive" INTEGER,
    "silverMarketPriceAtReceive" INTEGER,
    "platinumMarketPriceAtReceive" INTEGER,
    "location" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_STOCK',
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "InventoryPhoto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "inventoryId" INTEGER,
    "category" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "originalPath" TEXT NOT NULL,
    "thumbPath" TEXT NOT NULL,
    "largePath" TEXT,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryPhoto_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "InventoryItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "Party" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Payment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderType" TEXT NOT NULL,
    "orderId" INTEGER NOT NULL,
    "recycleOrderId" INTEGER,
    "exchangeOrderId" INTEGER,
    "sellOrderId" INTEGER,
    "method" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'IN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_recycleOrderId_fkey" FOREIGN KEY ("recycleOrderId") REFERENCES "RecycleOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Payment_exchangeOrderId_fkey" FOREIGN KEY ("exchangeOrderId") REFERENCES "ExchangeOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Payment_sellOrderId_fkey" FOREIGN KEY ("sellOrderId") REFERENCES "SellOrder" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "RecycleOrder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderNo" TEXT NOT NULL,
    "partyId" INTEGER,
    "totalPureWeight" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "recyclePrice" INTEGER NOT NULL,
    "rongtongjinPrice" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RecycleOrder_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "RecycleOrderItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderId" INTEGER NOT NULL,
    "itemName" TEXT NOT NULL,
    "metalType" TEXT NOT NULL DEFAULT 'GOLD',
    "grossWeight" INTEGER NOT NULL,
    "purity" INTEGER NOT NULL,
    "pureWeight" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    CONSTRAINT "RecycleOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "RecycleOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "SellOrder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderNo" TEXT NOT NULL,
    "partyId" INTEGER,
    "totalPureWeight" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "sellPrice" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SellOrder_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "SellOrderItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sellOrderId" INTEGER NOT NULL,
    "inventoryItemId" INTEGER NOT NULL,
    "pureWeight" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "costAmount" INTEGER NOT NULL,
    "costPureWeight" INTEGER NOT NULL,
    CONSTRAINT "SellOrderItem_sellOrderId_fkey" FOREIGN KEY ("sellOrderId") REFERENCES "SellOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SellOrderItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "StocktakingItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "stocktakingId" INTEGER NOT NULL,
    "inventoryItemId" INTEGER NOT NULL,
    "systemPureWeight" INTEGER NOT NULL,
    "actualPureWeight" INTEGER,
    "difference" INTEGER,
    CONSTRAINT "StocktakingItem_stocktakingId_fkey" FOREIGN KEY ("stocktakingId") REFERENCES "StocktakingOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StocktakingItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "StocktakingOrder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderNo" TEXT NOT NULL,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "SystemConfig" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

CREATE INDEX "ExchangeNewItem_exchangeId_idx" ON "ExchangeNewItem"("exchangeId");

CREATE INDEX "ExchangeOldItem_exchangeId_idx" ON "ExchangeOldItem"("exchangeId");

CREATE UNIQUE INDEX "ExchangeOrder_orderNo_key" ON "ExchangeOrder"("orderNo");

CREATE INDEX "ExchangeOrder_partyId_idx" ON "ExchangeOrder"("partyId");

CREATE INDEX "InventoryItem_location_idx" ON "InventoryItem"("location");

CREATE INDEX "InventoryItem_metalType_idx" ON "InventoryItem"("metalType");

CREATE INDEX "InventoryItem_status_idx" ON "InventoryItem"("status");

CREATE UNIQUE INDEX "InventoryItem_uniqueCode_key" ON "InventoryItem"("uniqueCode");

CREATE INDEX "InventoryPhoto_category_idx" ON "InventoryPhoto"("category");

CREATE INDEX "InventoryPhoto_inventoryId_idx" ON "InventoryPhoto"("inventoryId");

CREATE INDEX "Payment_orderType_orderId_idx" ON "Payment"("orderType", "orderId");

CREATE INDEX "RecycleOrderItem_orderId_idx" ON "RecycleOrderItem"("orderId");

CREATE UNIQUE INDEX "RecycleOrder_orderNo_key" ON "RecycleOrder"("orderNo");

CREATE INDEX "RecycleOrder_partyId_idx" ON "RecycleOrder"("partyId");

CREATE INDEX "SellOrderItem_sellOrderId_idx" ON "SellOrderItem"("sellOrderId");

CREATE UNIQUE INDEX "SellOrder_orderNo_key" ON "SellOrder"("orderNo");

CREATE INDEX "SellOrder_partyId_idx" ON "SellOrder"("partyId");

CREATE INDEX "StocktakingItem_stocktakingId_idx" ON "StocktakingItem"("stocktakingId");

CREATE UNIQUE INDEX "StocktakingOrder_orderNo_key" ON "StocktakingOrder"("orderNo");
