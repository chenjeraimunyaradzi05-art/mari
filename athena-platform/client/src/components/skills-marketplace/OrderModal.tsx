'use client';

import { useState } from 'react';
import { Check, Clock, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { SkillService, ServicePackage } from './ServiceCard';
import { cn } from '@/lib/utils';

interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: SkillService;
  onOrder: (packageIndex: number, requirements: string) => Promise<void>;
}

export function OrderModal({ isOpen, onClose, service, onOrder }: OrderModalProps) {
  const [selectedPackage, setSelectedPackage] = useState(0);
  const [requirements, setRequirements] = useState('');
  const [step, setStep] = useState<'select' | 'requirements' | 'confirm'>('select');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const pkg = service.packages[selectedPackage];

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      await onOrder(selectedPackage, requirements);
      handleClose();
    } catch (err) {
      setError('Failed to place order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep('select');
    setSelectedPackage(0);
    setRequirements('');
    setError('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Order Service" size="lg">
      <div className="p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Step: Select Package */}
        {step === 'select' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Choose a Package
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {service.packages.map((pkg, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedPackage(index)}
                  className={cn(
                    'p-4 rounded-xl border-2 text-left transition-all',
                    selectedPackage === index
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  )}
                >
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                    {pkg.name}
                  </h4>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    {formatPrice(pkg.price)}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                    {pkg.description}
                  </p>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                      <Clock className="w-4 h-4" />
                      <span>{pkg.deliveryDays} day delivery</span>
                    </div>
                    {pkg.revisions !== undefined && (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                        <RefreshCw className="w-4 h-4" />
                        <span>
                          {pkg.revisions === -1 ? 'Unlimited' : pkg.revisions} revisions
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 space-y-1">
                    {pkg.features.map((feature, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-600 dark:text-gray-300">{feature}</span>
                      </div>
                    ))}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex justify-end pt-4">
              <Button onClick={() => setStep('requirements')}>
                Continue with {pkg.name}
              </Button>
            </div>
          </div>
        )}

        {/* Step: Requirements */}
        {step === 'requirements' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Tell the seller what you need
            </h3>
            <p className="text-sm text-gray-500">
              Provide details about your project so the seller can deliver exactly what you're looking for.
            </p>

            <textarea
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              placeholder="Describe your requirements in detail..."
              rows={6}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />

            <div className="flex justify-between pt-4">
              <Button variant="ghost" onClick={() => setStep('select')}>
                Back
              </Button>
              <Button onClick={() => setStep('confirm')}>Continue</Button>
            </div>
          </div>
        )}

        {/* Step: Confirm */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Confirm Your Order
            </h3>

            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-xl space-y-4">
              <div className="flex items-start gap-4">
                {service.images[0] && (
                  <img
                    src={service.images[0]}
                    alt={service.title}
                    className="w-20 h-16 object-cover rounded"
                  />
                )}
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {service.title}
                  </h4>
                  <p className="text-sm text-gray-500">
                    by {service.seller.firstName} {service.seller.lastName}
                  </p>
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Package</span>
                  <span className="text-gray-900 dark:text-white font-medium">{pkg.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Delivery</span>
                  <span className="text-gray-900 dark:text-white">{pkg.deliveryDays} days</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Revisions</span>
                  <span className="text-gray-900 dark:text-white">
                    {pkg.revisions === -1 ? 'Unlimited' : pkg.revisions || 0}
                  </span>
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <div className="flex justify-between">
                  <span className="font-medium text-gray-900 dark:text-white">Total</span>
                  <span className="text-xl font-bold text-gray-900 dark:text-white">
                    {formatPrice(pkg.price)}
                  </span>
                </div>
              </div>
            </div>

            {requirements && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Your Requirements
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                  {requirements}
                </p>
              </div>
            )}

            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-sm">
              Payment will be held securely until you approve the delivered work.
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="ghost" onClick={() => setStep('requirements')}>
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  `Order for ${formatPrice(pkg.price)}`
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default OrderModal;
