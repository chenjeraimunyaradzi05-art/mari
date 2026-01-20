-- Finance domain check constraints

ALTER TABLE "AccountingAccount"
  ADD CONSTRAINT "AccountingAccount_currency_len" CHECK (char_length("currency") = 3);

ALTER TABLE "JournalLine"
  ADD CONSTRAINT "JournalLine_debit_credit_nonnegative" CHECK ("debit" >= 0 AND "credit" >= 0),
  ADD CONSTRAINT "JournalLine_debit_or_credit" CHECK ("debit" > 0 OR "credit" > 0);

ALTER TABLE "TaxRate"
  ADD CONSTRAINT "TaxRate_rate_range" CHECK ("rate" >= 0 AND "rate" <= 1);

ALTER TABLE "TaxReturn"
  ADD CONSTRAINT "TaxReturn_totalSales_nonnegative" CHECK ("totalSales" >= 0),
  ADD CONSTRAINT "TaxReturn_totalTax_nonnegative" CHECK ("totalTax" >= 0);

ALTER TABLE "InventoryItem"
  ADD CONSTRAINT "InventoryItem_cost_nonnegative" CHECK ("cost" >= 0),
  ADD CONSTRAINT "InventoryItem_price_nonnegative" CHECK ("price" >= 0);

ALTER TABLE "InventoryTransaction"
  ADD CONSTRAINT "InventoryTransaction_quantity_nonzero" CHECK ("quantity" <> 0),
  ADD CONSTRAINT "InventoryTransaction_unitCost_nonnegative" CHECK ("unitCost" IS NULL OR "unitCost" >= 0),
  ADD CONSTRAINT "InventoryTransaction_totalCost_nonnegative" CHECK ("totalCost" IS NULL OR "totalCost" >= 0);

ALTER TABLE "MoneyTransaction"
  ADD CONSTRAINT "MoneyTransaction_amount_positive" CHECK ("amount" > 0),
  ADD CONSTRAINT "MoneyTransaction_currency_len" CHECK (char_length("currency") = 3);
