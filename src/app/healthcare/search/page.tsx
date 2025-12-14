'use client';

import React, { useState } from 'react';
import { Search, MapPin, Filter, Star, Heart, ShoppingBag, ArrowRight, CheckCircle2 } from 'lucide-react';

// Mock Data for WellnessHub
const ITEMS = [
  {
    id: 1,
    type: 'service',
    category: 'Fitness',
    title: 'Elite Performance Gym',
    location: 'Sydney, CBD',
    rating: 4.9,
    reviews: 128,
    price: '$25/week',
    image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=1000',
    tags: ['24/7 Access', 'Personal Training', 'Sauna'],
    description: 'Premium fitness facility featuring state-of-the-art equipment, expert trainers, and luxury amenities.'
  },
  {
    id: 2,
    type: 'product',
    category: 'Nutrition',
    title: 'Organic Whey Protein',
    brand: 'PureLife Nutrition',
    rating: 4.8,
    reviews: 856,
    price: '$49.99',
    image: 'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?auto=format&fit=crop&q=80&w=1000',
    tags: ['Grass-Fed', 'Chocolate', '2kg'],
    description: 'High-quality grass-fed whey protein isolate. No artificial sweeteners or additives.'
  },
  {
    id: 3,
    type: 'service',
    category: 'Mental Health',
    title: 'Zen Yoga Studio',
    location: 'Melbourne, Fitzroy',
    rating: 5.0,
    reviews: 64,
    price: '$30/class',
    image: 'https://images.unsplash.com/photo-1599447421405-0c325d26d77e?auto=format&fit=crop&q=80&w=1000',
    tags: ['Vinyasa', 'Meditation', 'Beginner Friendly'],
    description: 'A sanctuary for mind and body. Join our community for daily yoga and meditation classes.'
  },
  {
    id: 4,
    type: 'service',
    category: 'Fitness',
    title: 'CrossFit 4000',
    location: 'Brisbane, Valley',
    rating: 4.7,
    reviews: 210,
    price: '$55/week',
    image: 'https://images.unsplash.com/photo-1517963879466-e1b54ebd512d?auto=format&fit=crop&q=80&w=1000',
    tags: ['Group Classes', 'HIIT', 'Community'],
    description: 'High-intensity functional training for all fitness levels. Join the fittest community in town.'
  },
  {
    id: 5,
    type: 'product',
    category: 'Gear',
    title: 'Pro Yoga Mat',
    brand: 'Lululemon',
    rating: 4.9,
    reviews: 1200,
    price: '$89.00',
    image: 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?auto=format&fit=crop&q=80&w=1000',
    tags: ['Non-slip', 'Eco-friendly', '5mm'],
    description: 'The mat that started it all. Extra cushioning and grip for your deepest stretches.'
  },
  {
    id: 6,
    type: 'service',
    category: 'Nutrition',
    title: 'Sarah Jones - Dietitian',
    location: 'Online / Sydney',
    rating: 5.0,
    reviews: 42,
    price: '$120/consult',
    image: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=1000',
    tags: ['Meal Plans', 'Sports Nutrition', 'Gut Health'],
    description: 'Accredited Practising Dietitian specializing in sports performance and gut health optimization.'
  }
];

export default function HealthcareSearch() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<typeof ITEMS[0] | null>(null);

  const filteredItems = ITEMS.filter(item => {
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-rose-600 rounded-lg flex items-center justify-center text-white font-bold">
              W
            </div>
            <span className="font-bold text-xl text-slate-900">WellnessHub</span>
          </div>
          <div className="flex items-center gap-4">
            <button className="text-sm font-medium text-slate-600 hover:text-rose-600">For Business</button>
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
              <Heart className="w-4 h-4" />
            </div>
          </div>
        </div>
        
        {/* Search & Filters */}
        <div className="border-t border-slate-100 bg-white/50 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search for gyms, supplements, yoga..." 
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border-transparent focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 rounded-xl outline-none transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="relative hidden md:block w-64">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Location" 
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border-transparent focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 rounded-xl outline-none transition-all"
                  defaultValue="Sydney, Australia"
                />
              </div>
              <button className="px-4 py-2.5 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 transition-colors flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Filters
              </button>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {['All', 'Fitness', 'Nutrition', 'Mental Health', 'Gear'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                    selectedCategory === cat 
                      ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20' 
                      : 'bg-white border border-slate-200 text-slate-600 hover:border-rose-200 hover:text-rose-600'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 flex gap-6 h-[calc(100vh-180px)]">
        {/* Results List */}
        <div className={`flex-1 overflow-y-auto pr-2 ${selectedItem ? 'hidden lg:block' : ''}`}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-slate-900">{filteredItems.length} Results</h2>
            <span className="text-sm text-slate-500">Sorted by Recommended</span>
          </div>
          
          <div className="space-y-4">
            {filteredItems.map((item) => (
              <div 
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer hover:shadow-md flex gap-4 ${
                  selectedItem?.id === item.id ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-200 hover:border-rose-200'
                }`}
              >
                <div className="w-24 h-24 bg-slate-100 rounded-xl overflow-hidden shrink-0">
                  <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full uppercase tracking-wide">
                          {item.category}
                        </span>
                        {item.rating >= 4.8 && (
                          <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Star className="w-3 h-3 fill-amber-600" /> Top Rated
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-slate-900 truncate">{item.title}</h3>
                      <p className="text-sm text-slate-500 truncate">{item.type === 'service' ? item.location : item.brand}</p>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-900">{item.price}</div>
                      <div className="text-xs text-slate-400 flex items-center justify-end gap-1">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        {item.rating} ({item.reviews})
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.tags.slice(0, 3).map((tag, i) => (
                      <span key={i} className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded-md">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detail View (Desktop) */}
        <div className={`lg:w-[500px] bg-white rounded-3xl border border-slate-200 overflow-hidden flex flex-col ${selectedItem ? 'fixed inset-0 z-50 lg:static lg:z-auto' : 'hidden lg:flex'}`}>
          {selectedItem ? (
            <>
              <div className="relative h-64 bg-slate-100 shrink-0">
                <img src={selectedItem.image} alt={selectedItem.title} className="w-full h-full object-cover" />
                <button 
                  onClick={(e) => { e.stopPropagation(); setSelectedItem(null); }}
                  className="absolute top-4 left-4 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center text-slate-900 lg:hidden shadow-lg"
                >
                  <ArrowRight className="w-5 h-5 rotate-180" />
                </button>
                <button className="absolute top-4 right-4 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center text-rose-600 shadow-lg">
                  <Heart className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-1">{selectedItem.title}</h2>
                    <p className="text-slate-500 flex items-center gap-1">
                      {selectedItem.type === 'service' ? <MapPin className="w-4 h-4" /> : <ShoppingBag className="w-4 h-4" />}
                      {selectedItem.type === 'service' ? selectedItem.location : selectedItem.brand}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-rose-600">{selectedItem.price}</div>
                    <div className="flex items-center gap-1 text-sm font-medium text-slate-700 justify-end">
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      {selectedItem.rating}
                      <span className="text-slate-400 font-normal">({selectedItem.reviews} reviews)</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mb-6">
                  {selectedItem.tags.map((tag, i) => (
                    <span key={i} className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm font-medium">
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="space-y-6">
                  <div>
                    <h3 className="font-bold text-slate-900 mb-2">About</h3>
                    <p className="text-slate-600 leading-relaxed">
                      {selectedItem.description}
                    </p>
                  </div>

                  <div className="p-4 bg-rose-50 rounded-xl border border-rose-100">
                    <h4 className="font-bold text-rose-900 mb-2 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-rose-600" />
                      Verified Partner
                    </h4>
                    <p className="text-sm text-rose-800/80">
                      This business has been verified for quality and service standards. Book with confidence.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-white">
                <button className="w-full py-4 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow-lg shadow-rose-600/20 transition-all flex items-center justify-center gap-2">
                  {selectedItem.type === 'service' ? 'Book Now' : 'Add to Cart'}
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-lg font-medium text-slate-600">Select an item to view details</p>
              <p className="text-sm">Click on any card from the list to see more information.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
