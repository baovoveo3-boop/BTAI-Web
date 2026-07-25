"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

export default function Pricing() {
  const [activeCategory, setActiveCategory] = useState<'subscription' | 'retail'>('subscription');
  const [retailBilling, setRetailBilling] = useState<'monthly' | 'lifetime'>('monthly');
  const [isYearly, setIsYearly] = useState(false);

  const [tiers, setTiers] = useState<any[]>([]);
  const [combos, setCombos] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [tiersSnap, combosSnap, productsSnap] = await Promise.all([
          getDocs(collection(db, 'tiers')),
          getDocs(collection(db, 'combos')),
          getDocs(collection(db, 'products'))
        ]);
        
        const fetchedTiers = tiersSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        const fetchedCombos = combosSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        const fetchedProducts = productsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

        // Sort Tiers by price
        fetchedTiers.sort((a, b) => (a.priceMonthly || 0) - (b.priceMonthly || 0));

        setTiers(fetchedTiers);
        setCombos(fetchedCombos);
        setProducts(fetchedProducts);
      } catch (error) {
        console.error("Error fetching pricing:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const formatMoney = (amount: number) => {
    if (amount === 0) return '0đ';
    if (amount >= 1000000) return (amount / 1000000).toFixed(2).replace(/\.00$/, '') + 'M';
    if (amount >= 1000) return (amount / 1000).toString() + 'K';
    return amount.toString() + 'đ';
  };

  if (loading) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 text-center text-zinc-400">
        Đang tải bảng giá...
      </section>
    );
  }

  return (
    <section 
      id="pricing"
      data-testid="pricing-section"
      className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8"
    >
      <div className="text-center">
        <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Bảng Giá Dịch Vụ
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-xl text-zinc-400">
          Lựa chọn gói phù hợp với nhu cầu của bạn. Nâng cấp hoặc hủy bất kỳ lúc nào.
        </p>
      </div>

      {/* Main Category Toggle */}
      <div className="mt-10 flex justify-center">
        <div className="bg-zinc-900/50 p-1.5 rounded-2xl flex flex-col sm:flex-row gap-1 border border-zinc-800 w-full max-w-[90%] sm:w-auto">
          <button
            onClick={() => setActiveCategory('subscription')}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeCategory === 'subscription' 
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg' 
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
            }`}
          >
            Gói Thành Viên (Tất cả Tool)
          </button>
          <button
            onClick={() => setActiveCategory('retail')}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeCategory === 'retail' 
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg' 
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
            }`}
          >
            Thuê/Mua Lẻ Tool
          </button>
        </div>
      </div>

      {/* Billing Toggle for Subscriptions */}
      {activeCategory === 'subscription' && (
        <div className="mt-8 flex justify-center items-center gap-4">
          <span className={`text-sm font-medium ${!isYearly ? 'text-white' : 'text-zinc-500'}`}>Thanh toán hàng tháng</span>
          <button
            onClick={() => setIsYearly(!isYearly)}
            data-testid="pricing-toggle"
            className="relative inline-flex h-7 w-14 items-center rounded-full bg-zinc-800 border border-zinc-700 transition-colors focus:outline-none"
          >
            <span className={`${isYearly ? 'translate-x-8 bg-purple-500' : 'translate-x-1 bg-zinc-500'} inline-block h-5 w-5 transform rounded-full transition-all`} />
          </button>
          <span className={`text-sm font-medium ${isYearly ? 'text-white' : 'text-zinc-500'}`}>
            Thanh toán hàng năm <span className="ml-1.5 rounded-md bg-purple-500/20 px-2 py-0.5 text-[10px] text-purple-400 font-bold uppercase tracking-wide">Tiết kiệm 20%</span>
          </span>
        </div>
      )}

      {activeCategory === 'subscription' ? (
        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {tiers.map((tier) => {
            const isFree = tier.id === 'tier-free';
            const isPlus = tier.id === 'tier-plus';
            const isPremium = tier.id === 'tier-premium';
            
            const price = isYearly ? tier.priceYearly : tier.priceMonthly;
            const priceDisplay = tier.priceText ? tier.priceText : formatMoney(price || 0);

            let cardClass = "flex flex-col justify-between rounded-3xl border border-zinc-800 bg-zinc-900/40 p-8 shadow-sm hover:border-zinc-700 transition-colors";
            let titleClass = "text-xl font-bold text-zinc-300";
            let checkColor = "text-zinc-500";
            let btnClass = "mt-8 block w-full rounded-xl bg-zinc-800 py-3 text-center text-sm font-semibold text-white hover:bg-zinc-700 transition";
            
            if (isPlus) {
              cardClass = "flex flex-col justify-between rounded-3xl border border-blue-500/30 bg-blue-900/10 p-8 shadow-sm relative hover:border-blue-500/50 transition-colors";
              titleClass = "text-xl font-bold text-blue-400";
              checkColor = "text-blue-500";
              btnClass = "mt-8 block w-full rounded-xl bg-blue-600/20 border border-blue-500/50 py-3 text-center text-sm font-semibold text-blue-400 hover:bg-blue-600 hover:text-white transition";
            } else if (isPremium) {
              cardClass = "relative flex flex-col justify-between rounded-3xl border-2 border-purple-500 bg-[#1e1e24] p-8 shadow-[0_0_40px_rgba(168,85,247,0.2)]";
              titleClass = "text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400";
              checkColor = "text-purple-500";
              btnClass = "mt-8 block w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 py-3 text-center text-sm font-bold text-white hover:opacity-90 transition shadow-lg shadow-purple-500/25";
            }

            return (
              <div key={tier.id} data-testid={`pricing-card-${tier.id}`} className={cardClass}>
                {tier.badgeText && (
                  <div className={`absolute -top-4 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-lg ${isPremium ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-gradient-to-r from-blue-500 to-purple-500'}`}>
                    {tier.badgeText}
                  </div>
                )}
                <div>
                  <h3 className={titleClass}>{tier.name}</h3>
                  <p className="mt-4 text-zinc-400 text-sm h-10">{tier.description}</p>
                  <div className="mt-6 flex items-baseline">
                    <span className="text-4xl font-extrabold text-white">{priceDisplay}</span>
                    {!isFree && (
                      <span className="ml-1 text-xl font-semibold text-zinc-500">
                        {isYearly ? '/năm' : '/tháng'}
                      </span>
                    )}
                  </div>
                  <ul className="mt-8 space-y-4 text-sm text-zinc-300">
                    {tier.features?.map((feat: any, idx: number) => (
                      <li key={idx} className={`flex items-center gap-2 ${feat.type === 'cross' ? 'text-zinc-500' : ''}`}>
                        <span className={feat.type === 'cross' ? 'text-red-900/50' : checkColor}>
                          {feat.type === 'cross' ? '❌' : '✅'}
                        </span>
                        {feat.text}
                      </li>
                    ))}
                  </ul>
                </div>
                <Link 
                  href={isFree ? `/hub?plan=free&billing=monthly` : `/hub?plan=${tier.id.replace('tier-', '')}&billing=${isYearly ? 'yearly' : 'monthly'}`} 
                  className={btnClass}
                >
                  {isFree ? 'Bắt đầu miễn phí' : (isPremium ? 'Nâng cấp Ultimate' : 'Đăng ký Gói')}
                </Link>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          {/* Retail Sub-Toggle */}
          <div className="mt-12 flex justify-center items-center gap-4">
            <span className={`text-sm font-medium ${retailBilling === 'monthly' ? 'text-white' : 'text-zinc-500'}`}>Thuê Tháng</span>
            <button
              onClick={() => setRetailBilling(retailBilling === 'monthly' ? 'lifetime' : 'monthly')}
              className="relative inline-flex h-7 w-14 items-center rounded-full bg-zinc-800 border border-zinc-700 transition-colors focus:outline-none"
            >
              <span className={`${retailBilling === 'lifetime' ? 'translate-x-8 bg-teal-500' : 'translate-x-1 bg-emerald-500'} inline-block h-5 w-5 transform rounded-full transition-all`} />
            </button>
            <span className={`text-sm font-medium ${retailBilling === 'lifetime' ? 'text-white' : 'text-zinc-500'}`}>
              Mua Đứt Vĩnh Viễn <span className="ml-1.5 rounded-md bg-teal-500/20 px-2 py-0.5 text-[10px] text-teal-400 font-bold uppercase tracking-wide">Tiết Kiệm</span>
            </span>
          </div>

          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {/* Render Products */}
            {products.map((product) => {
              const price = retailBilling === 'monthly' ? product.priceMonthly : product.priceLifetime;
              const priceDisplay = formatMoney(price || 0);

              return (
                <div key={product.id} className="flex flex-col justify-between rounded-3xl border border-zinc-800 bg-zinc-900/40 p-8 shadow-sm">
                  <div>
                    <h3 className="text-lg font-bold text-zinc-200">{product.name || product.id}</h3>
                    <div className="mt-4 flex items-baseline">
                      <span className="text-3xl font-extrabold text-emerald-400">{priceDisplay}</span>
                      <span className="ml-1 text-sm font-medium text-zinc-500">
                        {retailBilling === 'monthly' ? '/tháng' : '/vĩnh viễn'}
                      </span>
                    </div>
                    <ul className="mt-6 space-y-3 text-sm text-zinc-400">
                      <li>• Tool chuyên dụng lẻ</li>
                      {product.desc && <li>• {product.desc}</li>}
                    </ul>
                  </div>
                  <button className="mt-6 w-full rounded-xl bg-zinc-800/50 border border-zinc-700 py-2.5 text-sm font-semibold text-zinc-300 hover:text-white hover:bg-zinc-700 transition">
                    {retailBilling === 'monthly' ? 'Thuê ngay' : 'Mua đứt'}
                  </button>
                </div>
              );
            })}

            {/* Render Combos */}
            {combos.map((combo) => {
              const price = retailBilling === 'monthly' ? combo.priceMonthly : combo.priceLifetime;
              const priceDisplay = formatMoney(price || 0);

              return (
                <div key={combo.id} className="relative flex flex-col justify-between rounded-3xl border border-teal-500/50 bg-teal-900/10 p-8 shadow-[0_0_30px_rgba(20,184,166,0.15)]">
                  {combo.badgeText && (
                    <div className="absolute -top-3 right-6 rounded-md bg-teal-500 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                      {combo.badgeText}
                    </div>
                  )}
                  <div>
                    <h3 className="text-xl font-bold text-teal-400">{combo.name}</h3>
                    <div className="mt-4 flex items-baseline">
                      <span className="text-4xl font-extrabold text-white">{priceDisplay}</span>
                      <span className="ml-1 text-sm font-medium text-zinc-400">
                        {retailBilling === 'monthly' ? '/tháng' : '/vĩnh viễn'}
                      </span>
                    </div>
                    <ul className="mt-6 space-y-3 text-sm text-zinc-300 font-medium">
                      {combo.features?.map((feat: any, idx: number) => (
                        <li key={idx}>🔥 {feat.text}</li>
                      ))}
                    </ul>
                  </div>
                  <button className="mt-6 w-full rounded-xl bg-teal-600 py-2.5 text-sm font-bold text-white hover:bg-teal-500 transition shadow-lg shadow-teal-500/20">
                    Sở hữu trọn bộ
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
