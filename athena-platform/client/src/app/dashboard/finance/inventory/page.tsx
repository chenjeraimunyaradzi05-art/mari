'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

export default function InventoryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [levels, setLevels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState({
    organizationId: '',
    sku: '',
    name: '',
    description: '',
    unit: 'unit',
    valuationMethod: 'FIFO',
    currency: 'AUD',
    cost: '',
    price: '',
  });
  const [locationForm, setLocationForm] = useState({
    organizationId: '',
    name: '',
    code: '',
    address: '',
  });
  const [transactionForm, setTransactionForm] = useState({
    itemId: '',
    locationId: '',
    type: 'PURCHASE',
    quantity: '',
    unitCost: '',
    totalCost: '',
    reference: '',
    occurredAt: '',
  });
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState({
    sku: '',
    name: '',
    unit: 'unit',
    valuationMethod: 'FIFO',
    currency: 'AUD',
    cost: '',
    price: '',
  });
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [editingLocation, setEditingLocation] = useState({
    name: '',
    code: '',
    address: '',
  });
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState({
    type: 'PURCHASE',
    quantity: '',
    unitCost: '',
    totalCost: '',
    reference: '',
    occurredAt: '',
  });

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const [itemsRes, levelsRes, locationsRes, transactionsRes] = await Promise.all([
          api.get('/inventory/items'),
          api.get('/inventory/stock-levels'),
          api.get('/inventory/locations'),
          api.get('/inventory/transactions'),
        ]);

        if (!isMounted) return;
        setItems(itemsRes.data?.data || []);
        setLevels(levelsRes.data?.data || []);
        setLocations(locationsRes.data?.data || []);
        setTransactions(transactionsRes.data?.data || []);
      } catch {
        if (!isMounted) return;
        setItems([]);
        setLevels([]);
        setLocations([]);
        setTransactions([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const reload = async () => {
    const [itemsRes, levelsRes, locationsRes, transactionsRes] = await Promise.all([
      api.get('/inventory/items'),
      api.get('/inventory/stock-levels'),
      api.get('/inventory/locations'),
      api.get('/inventory/transactions'),
    ]);
    setItems(itemsRes.data?.data || []);
    setLevels(levelsRes.data?.data || []);
    setLocations(locationsRes.data?.data || []);
    setTransactions(transactionsRes.data?.data || []);
  };

  const handleCreateItem = async () => {
    if (!itemForm.sku.trim() || !itemForm.name.trim()) {
      setFormError('SKU and name are required');
      return;
    }
    setSaving(true);
    setFormError(null);
    const prevItems = items;
    setItems([
      {
        id: `tmp-${Date.now()}`,
        sku: itemForm.sku,
        name: itemForm.name,
        currency: itemForm.currency || 'AUD',
        cost: Number(itemForm.cost || 0),
        price: Number(itemForm.price || 0),
      },
      ...items,
    ]);
    try {
      await api.post('/inventory/items', {
        organizationId: itemForm.organizationId || undefined,
        sku: itemForm.sku,
        name: itemForm.name,
        description: itemForm.description || undefined,
        unit: itemForm.unit || undefined,
        valuationMethod: itemForm.valuationMethod,
        currency: itemForm.currency || undefined,
        cost: Number(itemForm.cost || 0),
        price: Number(itemForm.price || 0),
      });
      setItemForm({
        organizationId: '',
        sku: '',
        name: '',
        description: '',
        unit: 'unit',
        valuationMethod: 'FIFO',
        currency: 'AUD',
        cost: '',
        price: '',
      });
      await reload();
    } catch (error: any) {
      setItems(prevItems);
      setFormError(error?.response?.data?.error || 'Failed to create item');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateLocation = async () => {
    if (!locationForm.name.trim() || !locationForm.code.trim()) {
      setFormError('Location name and code are required');
      return;
    }
    setSaving(true);
    setFormError(null);
    const prevLocations = locations;
    setLocations([
      {
        id: `tmp-${Date.now()}`,
        name: locationForm.name,
        code: locationForm.code,
        address: locationForm.address,
      },
      ...locations,
    ]);
    try {
      await api.post('/inventory/locations', {
        organizationId: locationForm.organizationId || undefined,
        name: locationForm.name,
        code: locationForm.code,
        address: locationForm.address || undefined,
      });
      setLocationForm({
        organizationId: '',
        name: '',
        code: '',
        address: '',
      });
      await reload();
    } catch (error: any) {
      setLocations(prevLocations);
      setFormError(error?.response?.data?.error || 'Failed to create location');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTransaction = async () => {
    if (!transactionForm.itemId) {
      setFormError('Item is required');
      return;
    }
    const quantityValue = Number(transactionForm.quantity || 0);
    if (!Number.isFinite(quantityValue) || quantityValue === 0) {
      setFormError('Quantity must be non-zero');
      return;
    }
    setSaving(true);
    setFormError(null);
    const prevTransactions = transactions;
    setTransactions([
      {
        id: `tmp-${Date.now()}`,
        type: transactionForm.type,
        quantity: quantityValue,
        totalCost: transactionForm.totalCost ? Number(transactionForm.totalCost) : undefined,
      },
      ...transactions,
    ]);
    try {
      await api.post('/inventory/transactions', {
        itemId: transactionForm.itemId,
        locationId: transactionForm.locationId || undefined,
        type: transactionForm.type,
        quantity: quantityValue,
        unitCost: transactionForm.unitCost ? Number(transactionForm.unitCost) : undefined,
        totalCost: transactionForm.totalCost ? Number(transactionForm.totalCost) : undefined,
        reference: transactionForm.reference || undefined,
        occurredAt: transactionForm.occurredAt || undefined,
      });
      setTransactionForm({
        itemId: '',
        locationId: '',
        type: 'PURCHASE',
        quantity: '',
        unitCost: '',
        totalCost: '',
        reference: '',
        occurredAt: '',
      });
      await reload();
    } catch (error: any) {
      setTransactions(prevTransactions);
      setFormError(error?.response?.data?.error || 'Failed to create transaction');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Delete this item?')) return;
    const prevItems = items;
    setItems(items.filter((item) => item.id !== id));
    try {
      await api.delete(`/inventory/items/${id}`);
      await reload();
    } catch (error: any) {
      setItems(prevItems);
      setFormError(error?.response?.data?.error || 'Failed to delete item');
    }
  };

  const startEditItem = (item: any) => {
    setEditingItemId(item.id);
    setEditingItem({
      sku: item.sku || '',
      name: item.name || '',
      unit: item.unit || 'unit',
      valuationMethod: item.valuationMethod || 'FIFO',
      currency: item.currency || 'AUD',
      cost: item.cost ? String(item.cost) : '',
      price: item.price ? String(item.price) : '',
    });
  };

  const handleUpdateItem = async () => {
    if (!editingItemId) return;
    if (!editingItem.sku.trim() || !editingItem.name.trim()) {
      setFormError('SKU and name are required');
      return;
    }
    const prevItems = items;
    setItems(
      items.map((item) =>
        item.id === editingItemId
          ? {
              ...item,
              sku: editingItem.sku,
              name: editingItem.name,
              unit: editingItem.unit,
              valuationMethod: editingItem.valuationMethod,
              currency: editingItem.currency,
              cost: editingItem.cost ? Number(editingItem.cost) : 0,
              price: editingItem.price ? Number(editingItem.price) : 0,
            }
          : item
      )
    );
    try {
      await api.patch(`/inventory/items/${editingItemId}`, {
        sku: editingItem.sku,
        name: editingItem.name,
        unit: editingItem.unit,
        valuationMethod: editingItem.valuationMethod,
        currency: editingItem.currency,
        cost: editingItem.cost ? Number(editingItem.cost) : undefined,
        price: editingItem.price ? Number(editingItem.price) : undefined,
      });
      setEditingItemId(null);
      await reload();
    } catch (error: any) {
      setItems(prevItems);
      setFormError(error?.response?.data?.error || 'Failed to update item');
    }
  };

  const handleDeleteLocation = async (id: string) => {
    if (!confirm('Delete this location?')) return;
    const prevLocations = locations;
    setLocations(locations.filter((location) => location.id !== id));
    try {
      await api.delete(`/inventory/locations/${id}`);
      await reload();
    } catch (error: any) {
      setLocations(prevLocations);
      setFormError(error?.response?.data?.error || 'Failed to delete location');
    }
  };

  const startEditLocation = (location: any) => {
    setEditingLocationId(location.id);
    setEditingLocation({
      name: location.name || '',
      code: location.code || '',
      address: location.address || '',
    });
  };

  const handleUpdateLocation = async () => {
    if (!editingLocationId) return;
    if (!editingLocation.name.trim() || !editingLocation.code.trim()) {
      setFormError('Location name and code are required');
      return;
    }
    const prevLocations = locations;
    setLocations(
      locations.map((location) =>
        location.id === editingLocationId
          ? { ...location, ...editingLocation }
          : location
      )
    );
    try {
      await api.patch(`/inventory/locations/${editingLocationId}`, {
        name: editingLocation.name,
        code: editingLocation.code,
        address: editingLocation.address || undefined,
      });
      setEditingLocationId(null);
      await reload();
    } catch (error: any) {
      setLocations(prevLocations);
      setFormError(error?.response?.data?.error || 'Failed to update location');
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!confirm('Delete this transaction?')) return;
    const prevTransactions = transactions;
    setTransactions(transactions.filter((tx) => tx.id !== id));
    try {
      await api.delete(`/inventory/transactions/${id}`);
      await reload();
    } catch (error: any) {
      setTransactions(prevTransactions);
      setFormError(error?.response?.data?.error || 'Failed to delete transaction');
    }
  };

  const startEditTransaction = (tx: any) => {
    setEditingTransactionId(tx.id);
    setEditingTransaction({
      type: tx.type || 'PURCHASE',
      quantity: tx.quantity ? String(tx.quantity) : '',
      unitCost: tx.unitCost ? String(tx.unitCost) : '',
      totalCost: tx.totalCost ? String(tx.totalCost) : '',
      reference: tx.reference || '',
      occurredAt: tx.occurredAt ? new Date(tx.occurredAt).toISOString().slice(0, 16) : '',
    });
  };

  const handleUpdateTransaction = async () => {
    if (!editingTransactionId) return;
    const quantityValue = editingTransaction.quantity ? Number(editingTransaction.quantity) : 0;
    if (!Number.isFinite(quantityValue) || quantityValue === 0) {
      setFormError('Quantity must be non-zero');
      return;
    }
    const prevTransactions = transactions;
    setTransactions(
      transactions.map((tx) =>
        tx.id === editingTransactionId
          ? {
              ...tx,
              type: editingTransaction.type,
              quantity: quantityValue,
              unitCost: editingTransaction.unitCost ? Number(editingTransaction.unitCost) : undefined,
              totalCost: editingTransaction.totalCost ? Number(editingTransaction.totalCost) : undefined,
              reference: editingTransaction.reference,
              occurredAt: editingTransaction.occurredAt,
            }
          : tx
      )
    );
    try {
      await api.patch(`/inventory/transactions/${editingTransactionId}`, {
        type: editingTransaction.type,
        quantity: quantityValue,
        unitCost: editingTransaction.unitCost ? Number(editingTransaction.unitCost) : undefined,
        totalCost: editingTransaction.totalCost ? Number(editingTransaction.totalCost) : undefined,
        reference: editingTransaction.reference || undefined,
        occurredAt: editingTransaction.occurredAt || undefined,
      });
      setEditingTransactionId(null);
      await reload();
    } catch (error: any) {
      setTransactions(prevTransactions);
      setFormError(error?.response?.data?.error || 'Failed to update transaction');
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inventory</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Track items, costs, and stock levels.
          </p>
        </div>
        <Link href="/dashboard/finance" className="text-sm text-primary-600 hover:underline">
          Back to Finance Hub
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-sm text-gray-500 dark:text-gray-400">Items</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">
            {loading ? '—' : items.length}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500 dark:text-gray-400">Stock Positions</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">
            {loading ? '—' : levels.length}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">
            {loading ? 'Loading' : 'Ready'}
          </p>
        </div>
      </div>

      {formError && (
        <div className="card border border-red-200 bg-red-50 text-sm text-red-700">
          {formError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">New Item</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Organization ID (optional)</label>
              <input
                value={itemForm.organizationId}
                onChange={(e) => setItemForm({ ...itemForm, organizationId: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">SKU</label>
              <input
                value={itemForm.sku}
                onChange={(e) => setItemForm({ ...itemForm, sku: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Name</label>
              <input
                value={itemForm.name}
                onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Unit</label>
              <input
                value={itemForm.unit}
                onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Valuation</label>
              <select
                value={itemForm.valuationMethod}
                onChange={(e) => setItemForm({ ...itemForm, valuationMethod: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              >
                {['FIFO', 'LIFO', 'AVERAGE'].map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Currency</label>
              <input
                value={itemForm.currency}
                onChange={(e) => setItemForm({ ...itemForm, currency: e.target.value.toUpperCase() })}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Cost</label>
              <input
                value={itemForm.cost}
                onChange={(e) => setItemForm({ ...itemForm, cost: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Price</label>
              <input
                value={itemForm.price}
                onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button className="btn-primary" onClick={handleCreateItem} disabled={saving}>
            {saving ? 'Saving...' : 'Create Item'}
          </button>
        </div>

        <div className="card space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">New Location</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Organization ID (optional)</label>
              <input
                value={locationForm.organizationId}
                onChange={(e) => setLocationForm({ ...locationForm, organizationId: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Name</label>
              <input
                value={locationForm.name}
                onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Code</label>
              <input
                value={locationForm.code}
                onChange={(e) => setLocationForm({ ...locationForm, code: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 dark:text-gray-400">Address</label>
              <input
                value={locationForm.address}
                onChange={(e) => setLocationForm({ ...locationForm, address: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button className="btn-primary" onClick={handleCreateLocation} disabled={saving}>
            {saving ? 'Saving...' : 'Create Location'}
          </button>
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">New Transaction</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400">Item</label>
            <select
              value={transactionForm.itemId}
              onChange={(e) => setTransactionForm({ ...transactionForm, itemId: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            >
              <option value="">Select item</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400">Location (optional)</label>
            <input
              value={transactionForm.locationId}
              onChange={(e) => setTransactionForm({ ...transactionForm, locationId: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              placeholder="location_id"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400">Type</label>
            <select
              value={transactionForm.type}
              onChange={(e) => setTransactionForm({ ...transactionForm, type: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            >
              {['PURCHASE', 'SALE', 'ADJUSTMENT', 'TRANSFER', 'RETURN'].map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400">Quantity</label>
            <input
              value={transactionForm.quantity}
              onChange={(e) => setTransactionForm({ ...transactionForm, quantity: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400">Unit Cost</label>
            <input
              value={transactionForm.unitCost}
              onChange={(e) => setTransactionForm({ ...transactionForm, unitCost: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400">Total Cost</label>
            <input
              value={transactionForm.totalCost}
              onChange={(e) => setTransactionForm({ ...transactionForm, totalCost: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400">Reference</label>
            <input
              value={transactionForm.reference}
              onChange={(e) => setTransactionForm({ ...transactionForm, reference: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400">Occurred At</label>
            <input
              type="datetime-local"
              value={transactionForm.occurredAt}
              onChange={(e) => setTransactionForm({ ...transactionForm, occurredAt: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <button className="btn-primary" onClick={handleCreateTransaction} disabled={saving}>
          {saving ? 'Saving...' : 'Create Transaction'}
        </button>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Items</h2>
        </div>
        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading items...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No items added yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 text-xs font-semibold text-gray-500">SKU</th>
                  <th className="text-left py-2 text-xs font-semibold text-gray-500">Name</th>
                  <th className="text-left py-2 text-xs font-semibold text-gray-500">Cost</th>
                  <th className="text-left py-2 text-xs font-semibold text-gray-500">Price</th>
                  <th className="text-right py-2 text-xs font-semibold text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.slice(0, 6).map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 text-sm text-gray-900 dark:text-white">{item.sku}</td>
                    <td className="py-2 text-sm text-gray-600 dark:text-gray-300">{item.name}</td>
                    <td className="py-2 text-sm text-gray-600 dark:text-gray-300">
                      {formatCurrency(item.cost || 0, item.currency || 'AUD')}
                    </td>
                    <td className="py-2 text-sm text-gray-600 dark:text-gray-300">
                      {formatCurrency(item.price || 0, item.currency || 'AUD')}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => startEditItem(item)}
                        className="text-xs text-gray-600 hover:underline mr-2"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingItemId && (
        <div className="card space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Item</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              value={editingItem.sku}
              onChange={(e) => setEditingItem({ ...editingItem, sku: e.target.value })}
              className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              placeholder="SKU"
            />
            <input
              value={editingItem.name}
              onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
              className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              placeholder="Name"
            />
            <input
              value={editingItem.unit}
              onChange={(e) => setEditingItem({ ...editingItem, unit: e.target.value })}
              className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              placeholder="Unit"
            />
            <select
              value={editingItem.valuationMethod}
              onChange={(e) => setEditingItem({ ...editingItem, valuationMethod: e.target.value })}
              className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            >
              {['FIFO', 'LIFO', 'AVERAGE'].map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
            <input
              value={editingItem.currency}
              onChange={(e) => setEditingItem({ ...editingItem, currency: e.target.value.toUpperCase() })}
              className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              placeholder="Currency"
            />
            <input
              value={editingItem.cost}
              onChange={(e) => setEditingItem({ ...editingItem, cost: e.target.value })}
              className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              placeholder="Cost"
            />
            <input
              value={editingItem.price}
              onChange={(e) => setEditingItem({ ...editingItem, price: e.target.value })}
              className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              placeholder="Price"
            />
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={handleUpdateItem}>
              Save Changes
            </button>
            <button className="btn-outline" onClick={() => setEditingItemId(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Locations</h2>
        </div>
        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading locations...</p>
        ) : locations.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No locations added yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 text-xs font-semibold text-gray-500">Name</th>
                  <th className="text-left py-2 text-xs font-semibold text-gray-500">Code</th>
                  <th className="text-left py-2 text-xs font-semibold text-gray-500">Address</th>
                  <th className="text-right py-2 text-xs font-semibold text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {locations.slice(0, 6).map((location) => (
                  <tr key={location.id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 text-sm text-gray-900 dark:text-white">{location.name}</td>
                    <td className="py-2 text-sm text-gray-600 dark:text-gray-300">{location.code}</td>
                    <td className="py-2 text-sm text-gray-600 dark:text-gray-300">{location.address || '—'}</td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => startEditLocation(location)}
                        className="text-xs text-gray-600 hover:underline mr-2"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteLocation(location.id)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingLocationId && (
        <div className="card space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Location</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              value={editingLocation.name}
              onChange={(e) => setEditingLocation({ ...editingLocation, name: e.target.value })}
              className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              placeholder="Name"
            />
            <input
              value={editingLocation.code}
              onChange={(e) => setEditingLocation({ ...editingLocation, code: e.target.value })}
              className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              placeholder="Code"
            />
            <input
              value={editingLocation.address}
              onChange={(e) => setEditingLocation({ ...editingLocation, address: e.target.value })}
              className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              placeholder="Address"
            />
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={handleUpdateLocation}>
              Save Changes
            </button>
            <button className="btn-outline" onClick={() => setEditingLocationId(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Transactions</h2>
        </div>
        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading transactions...</p>
        ) : transactions.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No transactions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 text-xs font-semibold text-gray-500">Item</th>
                  <th className="text-left py-2 text-xs font-semibold text-gray-500">Type</th>
                  <th className="text-left py-2 text-xs font-semibold text-gray-500">Qty</th>
                  <th className="text-left py-2 text-xs font-semibold text-gray-500">Cost</th>
                  <th className="text-right py-2 text-xs font-semibold text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 6).map((tx) => (
                  <tr key={tx.id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 text-sm text-gray-900 dark:text-white">{tx.item?.name || '—'}</td>
                    <td className="py-2 text-sm text-gray-600 dark:text-gray-300">{tx.type}</td>
                    <td className="py-2 text-sm text-gray-600 dark:text-gray-300">{tx.quantity}</td>
                    <td className="py-2 text-sm text-gray-600 dark:text-gray-300">
                      {tx.totalCost ? formatCurrency(tx.totalCost, tx.item?.currency || 'AUD') : '—'}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => startEditTransaction(tx)}
                        className="text-xs text-gray-600 hover:underline mr-2"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteTransaction(tx.id)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingTransactionId && (
        <div className="card space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Transaction</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <select
              value={editingTransaction.type}
              onChange={(e) => setEditingTransaction({ ...editingTransaction, type: e.target.value })}
              className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            >
              {['PURCHASE', 'SALE', 'ADJUSTMENT', 'TRANSFER', 'RETURN'].map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <input
              value={editingTransaction.quantity}
              onChange={(e) => setEditingTransaction({ ...editingTransaction, quantity: e.target.value })}
              className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              placeholder="Quantity"
            />
            <input
              value={editingTransaction.unitCost}
              onChange={(e) => setEditingTransaction({ ...editingTransaction, unitCost: e.target.value })}
              className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              placeholder="Unit Cost"
            />
            <input
              value={editingTransaction.totalCost}
              onChange={(e) => setEditingTransaction({ ...editingTransaction, totalCost: e.target.value })}
              className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              placeholder="Total Cost"
            />
            <input
              value={editingTransaction.reference}
              onChange={(e) => setEditingTransaction({ ...editingTransaction, reference: e.target.value })}
              className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              placeholder="Reference"
            />
            <input
              type="datetime-local"
              value={editingTransaction.occurredAt}
              onChange={(e) => setEditingTransaction({ ...editingTransaction, occurredAt: e.target.value })}
              className="rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={handleUpdateTransaction}>
              Save Changes
            </button>
            <button className="btn-outline" onClick={() => setEditingTransactionId(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Stock Levels</h2>
        </div>
        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading stock levels...</p>
        ) : levels.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No stock movements yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 text-xs font-semibold text-gray-500">SKU</th>
                  <th className="text-left py-2 text-xs font-semibold text-gray-500">Location</th>
                  <th className="text-left py-2 text-xs font-semibold text-gray-500">Quantity</th>
                </tr>
              </thead>
              <tbody>
                {levels.slice(0, 6).map((level, index) => (
                  <tr key={`${level.itemId}-${level.locationId || index}`} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 text-sm text-gray-900 dark:text-white">{level.sku}</td>
                    <td className="py-2 text-sm text-gray-600 dark:text-gray-300">{level.location || 'Main'}</td>
                    <td className="py-2 text-sm text-gray-600 dark:text-gray-300">{level.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
