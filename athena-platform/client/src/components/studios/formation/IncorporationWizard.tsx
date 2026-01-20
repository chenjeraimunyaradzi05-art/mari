'use client';

/**
 * Step-by-Step Incorporation Wizard
 * Phase 4: Web Client - Persona Studios
 * Step 62: Multi-step form wizard for business registration
 * 
 * Features:
 * - Entity type selection
 * - State selection with recommendations
 * - Business information form
 * - Ownership/Members setup
 * - Document generation
 * - Payment & filing
 */

import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  Building2,
  Users,
  FileText,
  CreditCard,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Info,
  HelpCircle,
  Star,
  Shield,
  DollarSign,
  Globe,
  MapPin,
  User,
  Mail,
  Phone,
  Plus,
  Trash2,
  Check,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';

// ============================================
// TYPES
// ============================================

type EntityType = 'llc' | 'corporation' | 'sole-proprietor' | 'partnership' | 'non-profit';

interface EntityOption {
  type: EntityType;
  name: string;
  description: string;
  benefits: string[];
  considerations: string[];
  baseCost: number;
  recommended?: boolean;
}

interface StateOption {
  code: string;
  name: string;
  filingFee: number;
  annualFee: number;
  processingTime: string;
  benefits: string[];
  recommended?: boolean;
}

interface Owner {
  id: string;
  name: string;
  email: string;
  phone?: string;
  ownershipPercent: number;
  role: 'member' | 'manager' | 'owner' | 'director';
  isOrganizer: boolean;
}

interface FormData {
  entityType: EntityType | null;
  state: string;
  businessName: string;
  dba?: string;
  businessPurpose: string;
  businessAddress: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  registeredAgent: 'athena' | 'self' | 'other';
  registeredAgentDetails?: {
    name: string;
    address: string;
  };
  owners: Owner[];
  einRequired: boolean;
  expedited: boolean;
}

interface IncorporationWizardProps {
  onComplete?: (data: FormData) => void;
  className?: string;
}

// ============================================
// DATA
// ============================================

const ENTITY_OPTIONS: EntityOption[] = [
  {
    type: 'llc',
    name: 'Limited Liability Company (LLC)',
    description: 'Flexible structure with pass-through taxation and liability protection.',
    benefits: [
      'Personal asset protection',
      'Pass-through taxation',
      'Flexible management structure',
      'Less paperwork than corporations',
    ],
    considerations: [
      'Self-employment taxes on profits',
      'Limited life in some states',
    ],
    baseCost: 149,
    recommended: true,
  },
  {
    type: 'corporation',
    name: 'C Corporation',
    description: 'Traditional corporate structure ideal for raising investment.',
    benefits: [
      'Unlimited growth potential',
      'Attractive to investors',
      'Perpetual existence',
      'Stock options for employees',
    ],
    considerations: [
      'Double taxation',
      'More regulatory requirements',
      'Formal record keeping required',
    ],
    baseCost: 199,
  },
  {
    type: 'sole-proprietor',
    name: 'Sole Proprietorship',
    description: 'Simplest structure for individual business owners.',
    benefits: [
      'Easy to set up',
      'Complete control',
      'Simple tax filing',
      'Low cost',
    ],
    considerations: [
      'No liability protection',
      'Personal assets at risk',
      'Harder to raise capital',
    ],
    baseCost: 49,
  },
  {
    type: 'partnership',
    name: 'Partnership',
    description: 'Shared ownership between two or more individuals.',
    benefits: [
      'Pass-through taxation',
      'Shared responsibilities',
      'Easy to establish',
    ],
    considerations: [
      'Joint liability',
      'Potential for disputes',
      'Less formal structure',
    ],
    baseCost: 149,
  },
  {
    type: 'non-profit',
    name: 'Non-Profit Organization',
    description: 'Tax-exempt status for charitable, educational, or social purposes.',
    benefits: [
      'Tax-exempt status',
      'Eligible for grants',
      'Limited liability',
      'Public trust',
    ],
    considerations: [
      'Strict operational requirements',
      'Public disclosure rules',
      'Cannot distribute profits',
    ],
    baseCost: 299,
  },
];

const STATE_OPTIONS: StateOption[] = [
  {
    code: 'DE',
    name: 'Delaware',
    filingFee: 90,
    annualFee: 300,
    processingTime: '1-2 weeks',
    benefits: [
      'Business-friendly laws',
      'Court of Chancery expertise',
      'No state corporate tax (if not operating in DE)',
      'Privacy protection',
    ],
    recommended: true,
  },
  {
    code: 'WY',
    name: 'Wyoming',
    filingFee: 100,
    annualFee: 60,
    processingTime: '1-2 weeks',
    benefits: [
      'No state income tax',
      'Low annual fees',
      'Strong asset protection',
      'Privacy-friendly',
    ],
    recommended: true,
  },
  {
    code: 'NV',
    name: 'Nevada',
    filingFee: 425,
    annualFee: 350,
    processingTime: '2-3 weeks',
    benefits: [
      'No state corporate income tax',
      'No franchise tax',
      'Strong privacy laws',
    ],
  },
  {
    code: 'CA',
    name: 'California',
    filingFee: 70,
    annualFee: 800,
    processingTime: '3-4 weeks',
    benefits: [
      'Large market access',
      'Strong startup ecosystem',
    ],
  },
  {
    code: 'NY',
    name: 'New York',
    filingFee: 200,
    annualFee: 25,
    processingTime: '2-3 weeks',
    benefits: [
      'Financial hub',
      'Strong business infrastructure',
    ],
  },
  {
    code: 'TX',
    name: 'Texas',
    filingFee: 300,
    annualFee: 0,
    processingTime: '2-3 weeks',
    benefits: [
      'No state income tax',
      'Growing business environment',
      'No annual report requirement',
    ],
  },
];

const STEPS = [
  { id: 1, title: 'Entity Type', icon: Building2 },
  { id: 2, title: 'State', icon: MapPin },
  { id: 3, title: 'Business Info', icon: FileText },
  { id: 4, title: 'Ownership', icon: Users },
  { id: 5, title: 'Review & Pay', icon: CreditCard },
];

// ============================================
// STEP COMPONENTS
// ============================================

function EntityTypeStep({
  selected,
  onSelect,
}: {
  selected: EntityType | null;
  onSelect: (type: EntityType) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Choose Your Business Entity</h2>
        <p className="text-muted-foreground">
          Select the structure that best fits your business needs. Not sure? We recommend an LLC for most small businesses.
        </p>
      </div>

      <div className="grid gap-4">
        {ENTITY_OPTIONS.map((entity) => (
          <Card
            key={entity.type}
            className={cn(
              'cursor-pointer transition-all hover:border-emerald-500',
              selected === entity.type && 'border-emerald-500 ring-2 ring-emerald-500/20'
            )}
            onClick={() => onSelect(entity.type)}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div className={cn(
                  'p-2 rounded-lg',
                  selected === entity.type
                    ? 'bg-emerald-100 dark:bg-emerald-900/30'
                    : 'bg-zinc-100 dark:bg-zinc-800'
                )}>
                  <Building2 className={cn(
                    'h-5 w-5',
                    selected === entity.type
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-zinc-600 dark:text-zinc-400'
                  )} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{entity.name}</h3>
                    {entity.recommended && (
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        <Star className="h-3 w-3 mr-1" />
                        Recommended
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{entity.description}</p>
                  
                  <div className="grid md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-2">Benefits</p>
                      <ul className="space-y-1">
                        {entity.benefits.slice(0, 3).map((benefit, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                            <Check className="h-3 w-3 mt-0.5 text-emerald-500" />
                            {benefit}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400 mb-2">Considerations</p>
                      <ul className="space-y-1">
                        {entity.considerations.slice(0, 2).map((item, i) => (
                          <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                            <AlertCircle className="h-3 w-3 mt-0.5 text-yellow-500" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <span className="text-sm text-muted-foreground">Starting at</span>
                    <span className="text-lg font-semibold">${entity.baseCost}</span>
                  </div>
                </div>
                <div className={cn(
                  'h-5 w-5 rounded-full border-2 flex items-center justify-center',
                  selected === entity.type
                    ? 'border-emerald-500 bg-emerald-500'
                    : 'border-zinc-300 dark:border-zinc-600'
                )}>
                  {selected === entity.type && <Check className="h-3 w-3 text-white" />}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function StateSelectionStep({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (state: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Choose Your State of Formation</h2>
        <p className="text-muted-foreground">
          Where you incorporate affects taxes, fees, and legal protections. We recommend Delaware or Wyoming for most businesses.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {STATE_OPTIONS.map((state) => (
          <Card
            key={state.code}
            className={cn(
              'cursor-pointer transition-all hover:border-emerald-500',
              selected === state.code && 'border-emerald-500 ring-2 ring-emerald-500/20'
            )}
            onClick={() => onSelect(state.code)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{state.code}</span>
                  <div>
                    <h3 className="font-medium">{state.name}</h3>
                    {state.recommended && (
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs">
                        Recommended
                      </Badge>
                    )}
                  </div>
                </div>
                <div className={cn(
                  'h-5 w-5 rounded-full border-2 flex items-center justify-center',
                  selected === state.code
                    ? 'border-emerald-500 bg-emerald-500'
                    : 'border-zinc-300 dark:border-zinc-600'
                )}>
                  {selected === state.code && <Check className="h-3 w-3 text-white" />}
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Filing Fee</span>
                  <span className="font-medium">${state.filingFee}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Annual Fee</span>
                  <span className="font-medium">${state.annualFee}/year</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Processing</span>
                  <span>{state.processingTime}</span>
                </div>
              </div>

              <Separator className="my-3" />

              <ul className="space-y-1">
                {state.benefits.slice(0, 3).map((benefit, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                    <Check className="h-3 w-3 mt-0.5 text-emerald-500 shrink-0" />
                    {benefit}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function BusinessInfoStep({
  data,
  onChange,
}: {
  data: FormData;
  onChange: (updates: Partial<FormData>) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Business Information</h2>
        <p className="text-muted-foreground">
          Tell us about your business. This information will be used in your formation documents.
        </p>
      </div>

      <div className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="businessName">
              Business Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="businessName"
              placeholder="e.g., TechVenture Labs"
              value={data.businessName}
              onChange={(e) => onChange({ businessName: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Your official business name (LLC or Inc. will be added automatically)
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dba">
              DBA (Doing Business As)
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-3 w-3 inline ml-1" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Optional trade name if you want to operate under a different name than your legal business name</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <Input
              id="dba"
              placeholder="Optional"
              value={data.dba || ''}
              onChange={(e) => onChange({ dba: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="purpose">
            Business Purpose <span className="text-red-500">*</span>
          </Label>
          <Textarea
            id="purpose"
            placeholder="Describe what your business does..."
            value={data.businessPurpose}
            onChange={(e) => onChange({ businessPurpose: e.target.value })}
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            A brief description of your business activities
          </p>
        </div>

        <Separator />

        <div>
          <h3 className="font-medium mb-4">Business Address</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="street">Street Address</Label>
              <Input
                id="street"
                placeholder="123 Main St, Suite 100"
                value={data.businessAddress.street}
                onChange={(e) => onChange({
                  businessAddress: { ...data.businessAddress, street: e.target.value }
                })}
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  placeholder="City"
                  value={data.businessAddress.city}
                  onChange={(e) => onChange({
                    businessAddress: { ...data.businessAddress, city: e.target.value }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Select
                  value={data.businessAddress.state}
                  onValueChange={(value) => onChange({
                    businessAddress: { ...data.businessAddress, state: value }
                  })}
                >
                  <SelectTrigger id="state">
                    <SelectValue placeholder="State" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATE_OPTIONS.map((s) => (
                      <SelectItem key={s.code} value={s.code}>
                        {s.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="zip">ZIP Code</Label>
                <Input
                  id="zip"
                  placeholder="12345"
                  value={data.businessAddress.zip}
                  onChange={(e) => onChange({
                    businessAddress: { ...data.businessAddress, zip: e.target.value }
                  })}
                />
              </div>
            </div>
          </div>
        </div>

        <Separator />

        <div>
          <h3 className="font-medium mb-4">Registered Agent</h3>
          <p className="text-sm text-muted-foreground mb-4">
            A registered agent receives legal documents on behalf of your business. Required in all states.
          </p>
          <RadioGroup
            value={data.registeredAgent}
            onValueChange={(value: 'athena' | 'self' | 'other') => onChange({ registeredAgent: value })}
            className="space-y-3"
          >
            <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer">
              <RadioGroupItem value="athena" id="agent-athena" />
              <div className="flex-1">
                <Label htmlFor="agent-athena" className="cursor-pointer">
                  <span className="font-medium">Athena Registered Agent Service</span>
                  <Badge className="ml-2 bg-emerald-100 text-emerald-700">Recommended</Badge>
                </Label>
                <p className="text-sm text-muted-foreground">
                  We&apos;ll handle all legal correspondence and notify you immediately. $99/year
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer">
              <RadioGroupItem value="self" id="agent-self" />
              <div className="flex-1">
                <Label htmlFor="agent-self" className="cursor-pointer">Be my own registered agent</Label>
                <p className="text-sm text-muted-foreground">
                  You must be available during business hours at a physical address in the state
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer">
              <RadioGroupItem value="other" id="agent-other" />
              <div className="flex-1">
                <Label htmlFor="agent-other" className="cursor-pointer">Use a different registered agent</Label>
                <p className="text-sm text-muted-foreground">
                  Enter details for your chosen registered agent service
                </p>
              </div>
            </div>
          </RadioGroup>
        </div>
      </div>
    </div>
  );
}

function OwnershipStep({
  owners,
  onChange,
}: {
  owners: Owner[];
  onChange: (owners: Owner[]) => void;
}) {
  const addOwner = () => {
    const newOwner: Owner = {
      id: crypto.randomUUID(),
      name: '',
      email: '',
      ownershipPercent: 0,
      role: 'member',
      isOrganizer: owners.length === 0,
    };
    onChange([...owners, newOwner]);
  };

  const updateOwner = (id: string, updates: Partial<Owner>) => {
    onChange(owners.map((o) => (o.id === id ? { ...o, ...updates } : o)));
  };

  const removeOwner = (id: string) => {
    onChange(owners.filter((o) => o.id !== id));
  };

  const totalOwnership = owners.reduce((sum, o) => sum + (o.ownershipPercent || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Ownership & Members</h2>
        <p className="text-muted-foreground">
          Add the owners/members of your business. Each member&apos;s ownership percentage should total 100%.
        </p>
      </div>

      {totalOwnership !== 100 && owners.length > 0 && (
        <div className={cn(
          'flex items-center gap-2 p-3 rounded-lg',
          totalOwnership > 100 ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400' : 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400'
        )}>
          <AlertCircle className="h-5 w-5" />
          <span className="text-sm">
            Total ownership is {totalOwnership}%. {totalOwnership > 100 ? 'Please reduce' : 'Please add more'} to reach 100%.
          </span>
        </div>
      )}

      <div className="space-y-4">
        {owners.map((owner, index) => (
          <Card key={owner.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-medium">Member {index + 1}</h4>
                    {owner.isOrganizer && (
                      <Badge variant="outline" className="text-xs">Organizer</Badge>
                    )}
                  </div>
                </div>
                {owners.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeOwner(owner.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Legal Name</Label>
                  <Input
                    placeholder="John Doe"
                    value={owner.name}
                    onChange={(e) => updateOwner(owner.id, { name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="john@example.com"
                    value={owner.email}
                    onChange={(e) => updateOwner(owner.id, { email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={owner.role}
                    onValueChange={(value: Owner['role']) => updateOwner(owner.id, { role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="owner">Owner</SelectItem>
                      <SelectItem value="director">Director</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ownership %</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="50"
                    value={owner.ownershipPercent || ''}
                    onChange={(e) => updateOwner(owner.id, { ownershipPercent: Number(e.target.value) })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        <Button variant="outline" className="w-full" onClick={addOwner}>
          <Plus className="h-4 w-4 mr-2" />
          Add Another Member
        </Button>
      </div>
    </div>
  );
}

function ReviewPayStep({
  data,
  entityOption,
  stateOption,
}: {
  data: FormData;
  entityOption?: EntityOption;
  stateOption?: StateOption;
}) {
  const serviceFee = entityOption?.baseCost || 0;
  const stateFee = stateOption?.filingFee || 0;
  const agentFee = data.registeredAgent === 'athena' ? 99 : 0;
  const expeditedFee = data.expedited ? 50 : 0;
  const total = serviceFee + stateFee + agentFee + expeditedFee;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Review & Payment</h2>
        <p className="text-muted-foreground">
          Review your information and complete your order.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Business Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entity Type</span>
                <span className="font-medium">{entityOption?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">State</span>
                <span className="font-medium">{stateOption?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Business Name</span>
                <span className="font-medium">{data.businessName || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Members</span>
                <span className="font-medium">{data.owners.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Registered Agent</span>
                <span className="font-medium">
                  {data.registeredAgent === 'athena' ? 'Athena Service' : data.registeredAgent === 'self' ? 'Self' : 'Other'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Processing Options</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start space-x-3">
                <Checkbox id="expedited" checked={data.expedited} />
                <div>
                  <Label htmlFor="expedited" className="cursor-pointer">
                    Expedited Processing (+$50)
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Get your formation documents in 24-48 hours
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Athena Service Fee</span>
                <span>${serviceFee}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>State Filing Fee ({stateOption?.code})</span>
                <span>${stateFee}</span>
              </div>
              {agentFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Registered Agent (1 year)</span>
                  <span>${agentFee}</span>
                </div>
              )}
              {expeditedFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Expedited Processing</span>
                  <span>${expeditedFee}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-semibold text-lg">
                <span>Total</span>
                <span>${total}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-emerald-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-emerald-900 dark:text-emerald-100">
                    100% Satisfaction Guarantee
                  </h4>
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">
                    If your formation isn&apos;t approved, we&apos;ll refund your service fee.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button className="w-full" size="lg">
            <CreditCard className="h-4 w-4 mr-2" />
            Complete Payment
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            By completing payment, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function IncorporationWizard({ onComplete, className }: IncorporationWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    entityType: null,
    state: '',
    businessName: '',
    businessPurpose: '',
    businessAddress: { street: '', city: '', state: '', zip: '' },
    registeredAgent: 'athena',
    owners: [],
    einRequired: true,
    expedited: false,
  });

  const updateFormData = useCallback((updates: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  }, []);

  const entityOption = ENTITY_OPTIONS.find((e) => e.type === formData.entityType);
  const stateOption = STATE_OPTIONS.find((s) => s.code === formData.state);

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.entityType !== null;
      case 2:
        return formData.state !== '';
      case 3:
        return formData.businessName && formData.businessPurpose;
      case 4:
        const totalOwnership = formData.owners.reduce((sum, o) => sum + o.ownershipPercent, 0);
        return formData.owners.length > 0 && totalOwnership === 100;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep((prev) => prev + 1);
    } else {
      onComplete?.(formData);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const progress = (currentStep / STEPS.length) * 100;

  return (
    <div className={cn('max-w-4xl mx-auto', className)}>
      {/* Progress Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {STEPS.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;

            return (
              <div key={step.id} className="flex items-center">
                <div className={cn(
                  'flex items-center gap-2',
                  isActive && 'text-emerald-600 dark:text-emerald-400',
                  isCompleted && 'text-emerald-600 dark:text-emerald-400',
                  !isActive && !isCompleted && 'text-muted-foreground'
                )}>
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center',
                    isActive && 'bg-emerald-100 dark:bg-emerald-900/30',
                    isCompleted && 'bg-emerald-500 text-white',
                    !isActive && !isCompleted && 'bg-zinc-100 dark:bg-zinc-800'
                  )}>
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <StepIcon className="h-4 w-4" />
                    )}
                  </div>
                  <span className="hidden md:inline text-sm font-medium">{step.title}</span>
                </div>
                {index < STEPS.length - 1 && (
                  <div className={cn(
                    'w-8 md:w-16 h-0.5 mx-2',
                    isCompleted ? 'bg-emerald-500' : 'bg-zinc-200 dark:bg-zinc-700'
                  )} />
                )}
              </div>
            );
          })}
        </div>
        <Progress value={progress} className="h-1" />
      </div>

      {/* Step Content */}
      <div className="mb-8">
        {currentStep === 1 && (
          <EntityTypeStep
            selected={formData.entityType}
            onSelect={(type) => updateFormData({ entityType: type })}
          />
        )}
        {currentStep === 2 && (
          <StateSelectionStep
            selected={formData.state}
            onSelect={(state) => updateFormData({ state })}
          />
        )}
        {currentStep === 3 && (
          <BusinessInfoStep
            data={formData}
            onChange={updateFormData}
          />
        )}
        {currentStep === 4 && (
          <OwnershipStep
            owners={formData.owners}
            onChange={(owners) => updateFormData({ owners })}
          />
        )}
        {currentStep === 5 && (
          <ReviewPayStep
            data={formData}
            entityOption={entityOption}
            stateOption={stateOption}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 1}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button
          onClick={handleNext}
          disabled={!canProceed()}
        >
          {currentStep === STEPS.length ? 'Complete' : 'Continue'}
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

export default IncorporationWizard;
