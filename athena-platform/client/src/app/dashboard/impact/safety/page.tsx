'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Shield, Loader2, Phone, MapPin, Lock, FileText, AlertTriangle } from 'lucide-react';
import { impactApi } from '@/lib/api';

type SafetyPlan = {
  id: string;
  emergencyContacts?: unknown;
  safeLocations?: unknown;
  exitStrategies?: unknown;
  importantDocs?: unknown;
  financialPlan?: unknown;
  lastReviewedAt?: string;
};

type DVService = {
  id: string;
  name: string;
  type: string;
  phone?: string;
  website?: string;
  description?: string;
  available24x7: boolean;
  state?: string;
  isNational: boolean;
};

const serviceTypeLabels: Record<string, string> = {
  CRISIS: 'Crisis Line',
  LEGAL: 'Legal Support',
  FINANCIAL: 'Financial Aid',
  HOUSING: 'Housing',
  COUNSELING: 'Counseling',
  CHILDREN: 'Children Services',
};

export default function SafetyPage() {
  const [safetyPlan, setSafetyPlan] = useState<SafetyPlan | null>(null);
  const [services, setServices] = useState<DVService[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [serviceType, setServiceType] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Safety plan form state (simplified - in real app would be more structured)
  const [emergencyContacts, setEmergencyContacts] = useState('');
  const [safeLocations, setSafeLocations] = useState('');
  const [exitStrategies, setExitStrategies] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [planRes, servicesRes] = await Promise.all([
        impactApi.getSafetyPlan(),
        impactApi.getDVServices({ type: serviceType || undefined }),
      ]);
      setSafetyPlan(planRes.data?.data || null);
      setServices(servicesRes.data?.data || []);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error?.response?.data?.error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceType]);

  const handleSavePlan = async () => {
    setSaving(true);
    setError(null);
    try {
      await impactApi.saveSafetyPlan({
        emergencyContacts: emergencyContacts ? emergencyContacts.split('\n').filter(Boolean) : undefined,
        safeLocations: safeLocations ? safeLocations.split('\n').filter(Boolean) : undefined,
        exitStrategies: exitStrategies ? exitStrategies.split('\n').filter(Boolean) : undefined,
      });
      setShowPlanForm(false);
      await loadData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error?.response?.data?.error || 'Failed to save safety plan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div>
        <div className="flex items-center gap-2 text-red-600">
          <Shield className="w-5 h-5" />
          <span className="text-sm font-semibold uppercase tracking-wider">Safety Planning</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mt-2">
          DV Survivor Support
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Safety planning tools and support services
        </p>
      </div>

      {/* Emergency Banner */}
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
          <div>
            <h2 className="text-lg font-semibold text-red-800 dark:text-red-200">
              If you are in immediate danger
            </h2>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
              Call 000 (Australia) or your local emergency number immediately.
            </p>
            <div className="flex flex-wrap gap-4 mt-4">
              <a href="tel:1800737732" className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                <Phone className="w-4 h-4" /> 1800RESPECT (1800 737 732)
              </a>
              <a href="tel:131114" className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50">
                <Phone className="w-4 h-4" /> Lifeline (13 11 14)
              </a>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading...
        </div>
      ) : (
        <>
          {/* Safety Plan */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Lock className="w-5 h-5" /> My Safety Plan
              </h2>
              <button onClick={() => setShowPlanForm(!showPlanForm)} className="btn-primary text-sm">
                {safetyPlan ? 'Update' : 'Create'} plan
              </button>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4 text-sm text-yellow-800 dark:text-yellow-200">
              <Lock className="w-4 h-4 inline mr-2" />
              Your safety plan is private and encrypted. Only you can access it.
            </div>

            {showPlanForm && (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 mb-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Emergency Contacts (one per line)
                  </label>
                  <textarea
                    value={emergencyContacts}
                    onChange={(e) => setEmergencyContacts(e.target.value)}
                    placeholder="Name - Phone number - Relationship"
                    rows={3}
                    className="w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Safe Locations (one per line)
                  </label>
                  <textarea
                    value={safeLocations}
                    onChange={(e) => setSafeLocations(e.target.value)}
                    placeholder="Address or description of safe places"
                    rows={3}
                    className="w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Exit Strategies (one per line)
                  </label>
                  <textarea
                    value={exitStrategies}
                    onChange={(e) => setExitStrategies(e.target.value)}
                    placeholder="Steps to safely leave if needed"
                    rows={3}
                    className="w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSavePlan} disabled={saving} className="btn-primary">
                    {saving ? 'Saving...' : 'Save plan'}
                  </button>
                  <button onClick={() => setShowPlanForm(false)} className="btn-secondary">Cancel</button>
                </div>
              </div>
            )}

            {safetyPlan && !showPlanForm && (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                      <Phone className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Emergency Contacts</p>
                      <p className="text-xs text-gray-500">Configured</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Safe Locations</p>
                      <p className="text-xs text-gray-500">Configured</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                      <FileText className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Exit Strategies</p>
                      <p className="text-xs text-gray-500">Configured</p>
                    </div>
                  </div>
                </div>
                {safetyPlan.lastReviewedAt && (
                  <p className="text-xs text-gray-500 mt-4">
                    Last reviewed: {new Date(safetyPlan.lastReviewedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Support Services */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Support Services
              </h2>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                className="bg-transparent border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 text-sm"
              >
                <option value="">All services</option>
                {Object.entries(serviceTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            {services.length === 0 ? (
              <p className="text-sm text-gray-500">No services found.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {services.map((service) => (
                  <div
                    key={service.id}
                    className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-xs font-medium text-red-600">
                        {serviceTypeLabels[service.type] || service.type}
                      </span>
                      <div className="flex items-center gap-2">
                        {service.available24x7 && (
                          <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full">
                            24/7
                          </span>
                        )}
                        {service.isNational && (
                          <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 px-2 py-1 rounded-full">
                            National
                          </span>
                        )}
                      </div>
                    </div>

                    <h3 className="font-semibold text-gray-900 dark:text-white">{service.name}</h3>

                    {service.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">{service.description}</p>
                    )}

                    <div className="flex flex-wrap gap-3 mt-4">
                      {service.phone && (
                        <a
                          href={`tel:${service.phone.replace(/\s/g, '')}`}
                          className="inline-flex items-center gap-1 text-sm text-red-600 hover:underline"
                        >
                          <Phone className="w-4 h-4" /> {service.phone}
                        </a>
                      )}
                      {service.website && (
                        <a
                          href={service.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                        >
                          Visit website
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <div className="text-center">
        <Link href="/dashboard/impact" className="text-sm text-primary-600 hover:underline">
          ← Back to Impact Hub
        </Link>
      </div>
    </div>
  );
}
