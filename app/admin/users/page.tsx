"use client";

import React, { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, updateDoc, doc, writeBatch } from "firebase/firestore";
import { Users, Shield, Check, Edit2, ShieldAlert, MonitorSmartphone, Cpu, Package, Clock, X, Save, Trash2, Plus, ChevronDown, ChevronRight, CheckSquare, Square } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { logAdminAction } from "@/lib/adminLogger";

interface PurchasedProduct {
  id: string;
  expiresAt: string | null;
}

interface WebDevice {
  deviceId: string;
  userAgent: string;
  lastActive: any;
}

interface PcDevice {
  hwid: string;
  deviceName: string;
  lastActive: any;
}

interface ProductRecord {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
}

interface UserRecord {
  uid: string;
  email: string | null;
  displayName: string | null;
  walletBalance: number;
  currentTier: string;
  tierExpiresAt: string | null;
  role: "user" | "admin" | "super_admin";
  purchasedProducts: PurchasedProduct[];
  webDevices: WebDevice[];
  maxWebDevices?: number;
  pcDevices: PcDevice[];
  maxPcDevices?: number;
  createdAt?: any;
  hardware_id?: string;
}

export default function AdminUsers() {
  const { userData } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // States for toggling row content
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});

  // Edit Modal State
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  
  // Confirm Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {}
  });

  // Products Modal State
  const [allProducts, setAllProducts] = useState<ProductRecord[]>([]);
  const [allTiers, setAllTiers] = useState<{id: string, name: string}[]>([
    { id: 'free', name: 'Free' },
    { id: 'basic', name: 'Basic' },
    { id: 'pro', name: 'Pro' },
    { id: 'ultimate', name: 'Ultimate' },
  ]);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, "users"));
      const list: UserRecord[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        let pcDevs = data.pcDevices || [];
        // Hỗ trợ đọc HWID từ phần mềm cũ lưu dưới dạng field "hardware_id" string
        if (pcDevs.length === 0 && data.hardware_id) {
          pcDevs = [{
            hwid: data.hardware_id,
            deviceName: "PC App Launcher",
            lastActive: null
          }];
        }

        list.push({
          uid: docSnap.id,
          email: data.email || "",
          displayName: data.displayName || "",
          walletBalance: Number(data.walletBalance || 0),
          currentTier: data.currentTier || "free",
          tierExpiresAt: data.tierExpiresAt || null,
          role: data.role || "user",
          purchasedProducts: data.purchasedProducts || [],
          webDevices: data.webDevices || [],
          maxWebDevices: data.maxWebDevices || 1,
          pcDevices: pcDevs,
          maxPcDevices: data.maxPcDevices || 1,
          createdAt: data.createdAt,
          hardware_id: data.hardware_id // Keep a reference to raw string if needed
        });
      });
      // Sort in memory: super_admin -> admin -> user
      list.sort((a, b) => {
        const getRank = (r: string) => r === "super_admin" ? 3 : r === "admin" ? 2 : 1;
        const diff = getRank(b.role) - getRank(a.role);
        if (diff !== 0) return diff;
        return (a.displayName || "").localeCompare(b.displayName || "");
      });
      setUsers(list);
    } catch (error) {
      console.error("Lỗi khi tải danh sách người dùng:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const snap = await getDocs(collection(db, "products"));
      const list: ProductRecord[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          name: data.name || "Sản phẩm ẩn",
          price: Number(data.price || 0),
          imageUrl: data.imageUrl || "/software-box.jpg"
        });
      });
      setAllProducts(list);
    } catch (error) {
      console.error("Lỗi khi tải danh sách sản phẩm:", error);
    }
  };

  const fetchTiers = async () => {
    try {
      const snap = await getDocs(collection(db, "tiers"));
      if (!snap.empty) {
         setAllTiers(snap.docs.map(d => ({ id: d.id, name: d.data().name || d.id })));
      }
    } catch(e) {}
  };

  useEffect(() => {
    fetchUsers();
    fetchProducts();
    fetchTiers();
  }, []);

  const requestConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({ isOpen: true, title, message, onConfirm });
  };

  const closeConfirm = () => {
    setConfirmModal({ isOpen: false, title: "", message: "", onConfirm: () => {} });
  };

  const promoteToAdmin = (uid: string, email: string) => {
    requestConfirm(
      "Xác nhận Thăng cấp",
      `Bạn chuẩn bị cấp quyền Admin, nạp 1.000.000.000đ và gói Ultimate cho tài khoản ${email}. Hành động này sẽ được ghi vào nhật ký. Bạn có chắc chắn?`,
      async () => {
        closeConfirm();
        try {
          setUpdatingId(uid);
          const userRef = doc(db, "users", uid);
          await updateDoc(userRef, {
            role: "admin",
            currentTier: "ultimate",
            walletBalance: 1000000000,
            tierExpiresAt: "2099-12-31"
          });
          
          await logAdminAction({
            adminUid: userData?.uid || "unknown",
            adminEmail: userData?.email || "unknown",
            action: "PROMOTE_ADMIN",
            target: email,
            details: `Cấp quyền admin, nạp 1 tỷ VNĐ và gói ultimate.`
          });
          
          fetchUsers();
        } catch (error) {
          console.error("Lỗi khi thay đổi phân quyền:", error);
          alert("Lỗi khi thực hiện phân quyền.");
        } finally {
          setUpdatingId(null);
        }
      }
    );
  };

  const saveUserEdits = () => {
    if (!editingUser) return;
    
    // Find original user to compare
    const original = users.find(u => u.uid === editingUser.uid);
    
    // Identify new products
    const originalProductIds = original?.purchasedProducts.map(p => p.id) || [];
    const newProducts = editingUser.purchasedProducts.filter(p => !originalProductIds.includes(p.id));
    
    // Calculate total cost
    let totalCost = 0;
    const newProductNames: string[] = [];
    for (const p of newProducts) {
      const prodInfo = allProducts.find(x => x.id === p.id);
      if (prodInfo) {
        totalCost += prodInfo.price;
        newProductNames.push(prodInfo.name);
      }
    }
    
    // Check wallet balance
    if (totalCost > 0 && editingUser.walletBalance < totalCost) {
      alert(`LỖI: Số dư không đủ để mở khóa các sản phẩm mới!\n\nSố dư hiện tại (hoặc vừa nạp thêm): ${editingUser.walletBalance.toLocaleString()}đ\nTổng tiền cần trừ: ${totalCost.toLocaleString()}đ`);
      return;
    }
    
    const finalWalletBalance = editingUser.walletBalance - totalCost;

    let diffs = [];
    if (original?.walletBalance !== finalWalletBalance) diffs.push(`Số dư: ${original?.walletBalance} -> ${finalWalletBalance}`);
    if (original?.currentTier !== editingUser.currentTier) diffs.push(`Gói: ${original?.currentTier} -> ${editingUser.currentTier}`);
    if (original?.tierExpiresAt !== editingUser.tierExpiresAt) diffs.push(`Hạn gói: ${original?.tierExpiresAt} -> ${editingUser.tierExpiresAt}`);
    
    if (newProducts.length > 0) {
       diffs.push(`Mở khóa thêm Tool: ${newProductNames.join(", ")} (-${totalCost.toLocaleString()}đ)`);
    }
    
    const detailsMsg = diffs.length > 0 ? diffs.join(" | ") : "Cập nhật sản phẩm/thiết bị";

    requestConfirm(
      "Xác nhận Cập nhật Người dùng",
      `Bạn chuẩn bị lưu thay đổi cho tài khoản ${editingUser.email}. Các thay đổi: ${detailsMsg}. Hành động này sẽ lưu vào lịch sử.`,
      async () => {
        closeConfirm();
        try {
          setUpdatingId(editingUser.uid);
          const batch = writeBatch(db);
          const userRef = doc(db, "users", editingUser.uid);
          
          batch.update(userRef, {
            walletBalance: finalWalletBalance,
            currentTier: editingUser.currentTier,
            tierExpiresAt: editingUser.tierExpiresAt,
            purchasedProducts: editingUser.purchasedProducts,
            webDevices: editingUser.webDevices,
            maxWebDevices: editingUser.maxWebDevices || 1,
            pcDevices: editingUser.pcDevices,
            maxPcDevices: editingUser.maxPcDevices || 1,
            role: editingUser.role,
            hardware_id: editingUser.pcDevices && editingUser.pcDevices.length > 0 ? editingUser.pcDevices[0].hwid : null
          });

          // Sync licenses subcollection
          const licensesSnap = await getDocs(collection(db, `users/${editingUser.uid}/licenses`));
          licensesSnap.forEach((docSnap) => {
            batch.delete(docSnap.ref);
          });

          editingUser.purchasedProducts.forEach((p: any) => {
            let toolsToActivate = [p.id];
            if (p.id === 'combo-khoi-nghiep') {
              toolsToActivate = ['ban-content', 'tool-seeding-pro'];
            } else if (p.id === 'combo-scale-up') {
              toolsToActivate = ['ban-content', 'healing-bird'];
            } else if (p.id === 'combo-all-in-one') {
              toolsToActivate = ['ban-content', 'healing-bird', 'tool-seeding-pro'];
            }
            for (const tId of toolsToActivate) {
              const licenseRef = doc(db, `users/${editingUser.uid}/licenses`, tId);
              batch.set(licenseRef, {
                itemId: tId,
                status: 'active',
                expiresAt: p.expiresAt || null,
                activatedAt: p.purchasedAt || new Date().toISOString()
              });
            }
          });

          await batch.commit();

          // Sync RTDB via API route
          await fetch('/api/admin/sync-rtdb', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: editingUser.uid, purchasedProducts: editingUser.purchasedProducts })
          });

          await logAdminAction({
            adminUid: userData?.uid || "unknown",
            adminEmail: userData?.email || "unknown",
            action: newProducts.length > 0 ? "DEDUCT_BALANCE_FOR_TOOLS" : "EDIT_USER",
            target: editingUser.email || editingUser.uid,
            details: detailsMsg
          });

          setEditingUser(null);
          fetchUsers();
        } catch (error) {
          console.error("Lỗi khi lưu user:", error);
          alert("Lỗi khi lưu thông tin.");
        } finally {
          setUpdatingId(null);
        }
      }
    );
  };

  const handleProductChange = (index: number, field: string, value: string) => {
    if (!editingUser) return;
    const newProducts = [...editingUser.purchasedProducts];
    newProducts[index] = { ...newProducts[index], [field]: value };
    setEditingUser({ ...editingUser, purchasedProducts: newProducts });
  };

  const removeProduct = (index: number) => {
    if (!editingUser) return;
    const newProducts = editingUser.purchasedProducts.filter((_, i) => i !== index);
    setEditingUser({ ...editingUser, purchasedProducts: newProducts });
  };

  const removeWebDevice = (index: number) => {
    if (!editingUser) return;
    const newWebDevices = editingUser.webDevices.filter((_, i) => i !== index);
    setEditingUser({ ...editingUser, webDevices: newWebDevices });
  };

  const removePcDevice = (index: number) => {
    if (!editingUser) return;
    const newPcDevices = editingUser.pcDevices.filter((_, i) => i !== index);
    setEditingUser({ ...editingUser, pcDevices: newPcDevices });
  };

  const addProduct = () => {
    setSelectedProductIds([]);
    setProductSearch("");
    setIsProductModalOpen(true);
  };

  const handleQuickExpiration = (index: number, months: number | null) => {
    if (!editingUser) return;
    if (months === null) {
       handleProductChange(index, "expiresAt", "");
       return;
    }
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    handleProductChange(index, "expiresAt", `${yyyy}-${mm}-${dd}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Users className="h-6 w-6 text-neonPurple" /> Quản lý Người dùng
        </h1>
        <p className="text-sm text-zinc-400">Danh sách thành viên đăng ký, cấp quyền, kiểm soát thiết bị và các khóa học.</p>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-t-2 border-b-2 border-neonPurple"></div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/30">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50 text-xs font-bold uppercase tracking-wider text-zinc-400">
                <th className="p-4">Thành viên</th>
                <th className="p-4">Phân quyền</th>
                <th className="p-4">Ví & Gói</th>
                <th className="p-4">Sản phẩm</th>
                <th className="p-4">Thiết bị</th>
                <th className="p-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 text-sm">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-zinc-500">
                    Chưa có tài khoản nào được tạo lập.
                  </td>
                </tr>
              ) : (
                users.map((userRecord) => (
                  <tr key={userRecord.uid} className="hover:bg-zinc-900/20">
                    <td className="p-4">
                      <div className="font-bold text-white">{userRecord.displayName || "Thành viên"}</div>
                      <div className="text-zinc-400 font-mono text-xs">{userRecord.email || "—"}</div>
                    </td>
                    <td className="p-4">
                      {userRecord.role === "super_admin" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30">
                          <ShieldAlert className="h-3 w-3" /> Super Admin
                        </span>
                      ) : userRecord.role === "admin" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-neonPurple/10 text-neonPurple border border-neonPurple/20">
                          <Shield className="h-3 w-3" /> Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-400">
                          Thành viên
                        </span>
                      )}
                    </td>
                    <td className="p-4 align-top">
                      <div className="font-bold text-neonGreen font-mono">{userRecord.walletBalance.toLocaleString()}đ</div>
                      <div className="text-xs text-zinc-400 capitalize mt-1">
                        Gói: <span className="text-white">{userRecord.currentTier}</span>
                        {userRecord.tierExpiresAt && <span className="block text-zinc-500">Hạn: {userRecord.tierExpiresAt}</span>}
                      </div>
                    </td>
                    <td className="p-4 align-top">
                      <div 
                        className="flex items-center gap-1 text-zinc-300 mb-1.5 font-bold cursor-pointer hover:text-white transition w-max"
                        onClick={() => setExpandedProducts(prev => ({...prev, [userRecord.uid]: !prev[userRecord.uid]}))}
                      >
                        <Package className="h-4 w-4" /> {userRecord.purchasedProducts.length} SP
                        {userRecord.purchasedProducts.length > 0 && (
                          expandedProducts[userRecord.uid] ? <ChevronDown className="h-4 w-4 text-zinc-500" /> : <ChevronRight className="h-4 w-4 text-zinc-500" />
                        )}
                      </div>
                      {userRecord.purchasedProducts.length === 0 ? (
                        <div className="text-[11px] text-zinc-600 italic">Chưa có khóa học/tool</div>
                      ) : expandedProducts[userRecord.uid] ? (
                        <div className="space-y-1">
                          {userRecord.purchasedProducts.map((p, i) => (
                            <div key={i} className="text-[11px] bg-zinc-800/50 px-2 py-1 rounded border border-zinc-700/50">
                              <span className="font-bold text-white">{p.id}</span>
                              <span className="text-zinc-400 block mt-0.5">Hạn: {p.expiresAt || "Vĩnh viễn"}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </td>
                    <td className="p-4 align-top">
                      <div className="flex items-center gap-1 text-zinc-300 mb-1.5 font-bold">
                        <MonitorSmartphone className="h-4 w-4 text-zinc-400" /> Web: {userRecord.webDevices.length} / {userRecord.maxWebDevices || 1}
                      </div>
                      <div className="flex items-center gap-1 text-zinc-300 mb-1.5 font-bold">
                        <Cpu className="h-4 w-4 text-blue-400" /> PC: {userRecord.pcDevices.length} / {userRecord.maxPcDevices || 1}
                      </div>
                      {(userRecord.webDevices.length === 0 && userRecord.pcDevices.length === 0) ? (
                        <div className="text-[11px] text-zinc-600 italic">Chưa đăng nhập</div>
                      ) : null}
                    </td>
                    <td className="p-4 text-center space-x-2 align-top">
                      <button
                        onClick={() => setEditingUser(userRecord)}
                        className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-bold text-zinc-300 bg-zinc-800 rounded hover:bg-zinc-700 transition"
                      >
                        <Edit2 className="h-3.5 w-3.5" /> Sửa
                      </button>
                      
                      {/* Only super_admin can promote to admin */}
                      {userData?.role === "super_admin" && userRecord.role === "user" && (
                        <button
                          onClick={() => promoteToAdmin(userRecord.uid, userRecord.email || "")}
                          disabled={updatingId === userRecord.uid}
                          className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-bold text-white bg-neonPurple/20 border border-neonPurple/50 rounded hover:bg-neonPurple/40 transition disabled:opacity-50"
                        >
                          <Shield className="h-3.5 w-3.5" /> Lên Admin
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-3xl flex flex-col my-8 max-h-[90vh]">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Edit2 className="h-5 w-5 text-neonPurple" /> Chỉnh sửa {editingUser.email}
              </h2>
              <button onClick={() => setEditingUser(null)} className="text-zinc-400 hover:text-white">
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-8 flex-1">
              {/* Tài chính & Cấp độ */}
              <section className="space-y-4">
                <h3 className="text-lg font-bold text-white border-l-4 border-neonPurple pl-3">1. Tài chính & Cấp độ</h3>
                <div className="flex flex-col gap-4">
                  {/* Dòng 1: Số dư */}
                  <div>
                    <label className="block text-xs font-bold uppercase text-zinc-400 mb-1">Số dư (VNĐ)</label>
                    <input 
                      type="number"
                      value={editingUser.walletBalance}
                      onChange={e => setEditingUser({...editingUser, walletBalance: Number(e.target.value)})}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2 text-white font-mono focus:border-neonPurple focus:outline-none"
                    />
                  </div>
                  {/* Dòng 2: Gói Tài Khoản & Hạn Gói */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase text-zinc-400 mb-1">Gói Tài Khoản</label>
                      <select
                        value={editingUser.currentTier}
                        onChange={e => setEditingUser({...editingUser, currentTier: e.target.value})}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2 text-white focus:border-neonPurple focus:outline-none"
                      >
                        {allTiers.map(t => (
                          <option key={t.id} value={t.id} disabled={editingUser.currentTier === t.id}>{t.name} {editingUser.currentTier === t.id && '(Đang dùng)'}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-zinc-400 mb-1">Hạn Gói</label>
                      <div className="flex gap-2">
                        {editingUser.currentTier !== 'free' && (
                          <select onChange={e => {
                            const val = e.target.value;
                            if (val === 'lifetime') setEditingUser({...editingUser, tierExpiresAt: null});
                            else if (val) {
                              const d = new Date();
                              d.setMonth(d.getMonth() + Number(val));
                              setEditingUser({...editingUser, tierExpiresAt: d.toISOString().split('T')[0]});
                            }
                            e.target.value = "";
                          }} className="bg-zinc-800 text-xs text-zinc-300 rounded-lg px-2 focus:outline-none shrink-0 w-28">
                            <option value="">Gia hạn...</option>
                            <option value="1">1 Tháng</option>
                            <option value="2">2 Tháng</option>
                            <option value="3">3 Tháng</option>
                            <option value="6">6 Tháng</option>
                            <option value="12">1 Năm</option>
                            <option value="lifetime">Vĩnh viễn</option>
                          </select>
                        )}
                        {editingUser.currentTier === 'free' ? (
                          <input 
                            type="text"
                            disabled
                            value="Không áp dụng"
                            className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                        ) : (
                          <input 
                            type="date"
                            min={new Date().toISOString().split('T')[0]}
                            value={editingUser.tierExpiresAt || ""}
                            onChange={e => setEditingUser({...editingUser, tierExpiresAt: e.target.value || null})}
                            className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2 text-white focus:border-neonPurple focus:outline-none"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Dòng 3: Máy Web & PC */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase text-zinc-400 mb-1">Máy Web Tối Đa</label>
                      <input 
                        type="number"
                        min="1"
                        value={editingUser.maxWebDevices || 1}
                        onChange={e => setEditingUser({...editingUser, maxWebDevices: Number(e.target.value)})}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2 text-white focus:border-neonPurple focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-zinc-400 mb-1">Máy PC Tối Đa</label>
                      <input 
                        type="number"
                        min="1"
                        value={editingUser.maxPcDevices || 1}
                        onChange={e => setEditingUser({...editingUser, maxPcDevices: Number(e.target.value)})}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2 text-white focus:border-neonPurple focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Sản phẩm lẻ */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white border-l-4 border-neonGreen pl-3">2. Sản phẩm mở khóa lẻ</h3>
                  <button onClick={addProduct} className="text-xs flex items-center gap-1 bg-zinc-800 hover:bg-zinc-700 text-white px-2 py-1 rounded">
                    <Plus className="h-3 w-3" /> Thêm SP
                  </button>
                </div>
                {editingUser.purchasedProducts.length === 0 ? (
                  <p className="text-sm text-zinc-500 italic">Người dùng chưa mua sản phẩm lẻ nào.</p>
                ) : (
                  <div className="space-y-3">
                    {editingUser.purchasedProducts.map((prod, i) => {
                      const prodInfo = allProducts.find(p => p.id === prod.id);
                      return (
                        <div key={i} className="flex flex-col gap-2 bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                          <div className="flex gap-2 items-center">
                            <span className="flex-1 font-bold text-white truncate">{prodInfo ? prodInfo.name : prod.id} <span className="text-xs text-zinc-500 font-mono font-normal">({prod.id})</span></span>
                            <button onClick={() => removeProduct(i)} className="p-1 text-red-400 hover:bg-red-500/20 rounded shrink-0">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="flex gap-2 w-full">
                            <select onChange={e => {
                              if (e.target.value === "lifetime") handleQuickExpiration(i, null);
                              else if (e.target.value !== "") handleQuickExpiration(i, Number(e.target.value));
                              e.target.value = ""; 
                            }} className="bg-zinc-800 text-xs text-zinc-300 rounded px-2 py-1 focus:outline-none">
                              <option value="">Gia hạn nhanh...</option>
                              <option value="1">1 Tháng</option>
                              <option value="2">2 Tháng</option>
                              <option value="3">3 Tháng</option>
                              <option value="6">6 Tháng</option>
                              <option value="12">1 Năm</option>
                              <option value="lifetime">Vĩnh viễn</option>
                            </select>
                            <input 
                              type="text" 
                              placeholder="YYYY-MM-DD (trống = vĩnh viễn)"
                              value={prod.expiresAt || ""}
                              onChange={e => handleProductChange(i, "expiresAt", e.target.value)}
                              className="flex-1 bg-zinc-900 border border-zinc-800 text-white text-sm px-3 py-1.5 rounded focus:outline-none focus:border-neonPurple min-w-0"
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              {/* Thiết bị Web */}
              <section className="space-y-4">
                <h3 className="text-lg font-bold text-white border-l-4 border-zinc-400 pl-3">3. Thiết bị Web (Khóa học)</h3>
                {editingUser.webDevices.length === 0 ? (
                  <p className="text-sm text-zinc-500 italic">Chưa ghi nhận thiết bị nào.</p>
                ) : (
                  <div className="space-y-2">
                    {editingUser.webDevices.map((dev, i) => (
                      <div key={i} className="flex justify-between items-center bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-mono text-zinc-300">{dev.deviceId}</span>
                          <span className="text-xs text-zinc-500">
                            Trình duyệt: {dev.userAgent ? dev.userAgent.substring(0, 50) + "..." : "Không rõ"}
                          </span>
                          <span className="text-xs text-zinc-500">
                            Truy cập: {typeof dev.lastActive === 'string' ? new Date(dev.lastActive).toLocaleString("vi-VN") : (dev.lastActive?.toDate ? new Date(dev.lastActive.toDate()).toLocaleString("vi-VN") : "Gần đây")}
                          </span>
                        </div>
                        <button onClick={() => removeWebDevice(i)} className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-1.5 rounded-lg font-bold border border-red-500/20 transition">
                          Hủy kết nối
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Thiết bị PC */}
              <section className="space-y-4">
                <h3 className="text-lg font-bold text-white border-l-4 border-blue-400 pl-3">4. Thiết bị PC (Tool)</h3>
                {editingUser.pcDevices.length === 0 ? (
                  <p className="text-sm text-zinc-500 italic">Chưa ghi nhận thiết bị nào.</p>
                ) : (
                  <div className="space-y-2">
                    {editingUser.pcDevices.map((dev, i) => (
                      <div key={i} className="flex justify-between items-center bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                        <div className="flex flex-col">
                          <span className="text-sm font-mono text-zinc-300">{dev.hwid}</span>
                          <span className="text-xs text-zinc-500">Tên máy: {dev.deviceName} | Truy cập: {dev.lastActive?.toDate ? new Date(dev.lastActive.toDate()).toLocaleString("vi-VN") : "Gần đây"}</span>
                        </div>
                        <button onClick={() => removePcDevice(i)} className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-1.5 rounded-lg font-bold border border-red-500/20 transition">
                          Hủy kết nối
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Phân quyền */}
              {userData?.role === "super_admin" && editingUser.role !== "super_admin" && (
                <section className="space-y-4">
                  <h3 className="text-lg font-bold text-white border-l-4 border-yellow-400 pl-3">5. Phân quyền</h3>
                  <div>
                    <label className="block text-xs font-bold uppercase text-zinc-400 mb-1">Vai Trò (Role)</label>
                    <select
                      value={editingUser.role}
                      onChange={e => setEditingUser({...editingUser, role: e.target.value as any})}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2 text-white focus:border-neonPurple focus:outline-none"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                    <p className="text-xs text-zinc-500 mt-2 italic">Admin có quyền truy cập Dashboard và chỉnh sửa User khác. Chỉ Super Admin mới có thể thay đổi mục này.</p>
                  </div>
                </section>
              )}
            </div>

            <div className="p-6 border-t border-zinc-800 flex justify-end shrink-0 gap-3">
              <button 
                onClick={() => setEditingUser(null)}
                className="px-6 py-2 rounded-lg font-bold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 transition"
              >
                Hủy
              </button>
              <button 
                onClick={saveUserEdits}
                disabled={updatingId === editingUser.uid}
                className="flex items-center gap-2 px-6 py-2 rounded-lg font-bold text-white bg-neonPurple hover:bg-neonPurple-dark transition disabled:opacity-50"
              >
                {updatingId === editingUser.uid ? "Đang lưu..." : <><Save className="h-4 w-4" /> Lưu thay đổi</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="bg-zinc-900 border-2 border-red-500/50 rounded-2xl w-full max-w-md p-6 space-y-6 shadow-2xl shadow-red-500/10">
            <div className="flex items-center gap-3 text-red-500">
              <ShieldAlert className="h-8 w-8" />
              <h3 className="text-xl font-bold">{confirmModal.title}</h3>
            </div>
            <p className="text-zinc-300 leading-relaxed">
              {confirmModal.message}
            </p>
            <div className="flex gap-3 pt-4">
              <button 
                onClick={closeConfirm}
                className="flex-1 py-2.5 rounded-xl font-bold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 transition"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={confirmModal.onConfirm}
                className="flex-1 py-2.5 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/30 transition"
              >
                Xác nhận thao tác
              </button>
            </div>
          </div>
        </div>
      )}
      {/* PRODUCT SELECTION MODAL */}
      {isProductModalOpen && (() => {
        const selectedTotalCost = selectedProductIds.reduce((sum, id) => {
          const p = allProducts.find(x => x.id === id);
          return sum + (p ? p.price : 0);
        }, 0);
        const tempBalance = (editingUser?.walletBalance || 0) - selectedTotalCost;

        const availableProducts = allProducts.filter(p => !editingUser?.purchasedProducts.some(ep => ep.id === p.id));
        const filteredProducts = availableProducts.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.id.toLowerCase().includes(productSearch.toLowerCase()));

        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
              <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Package className="h-5 w-5 text-neonPurple" /> Chọn Sản Phẩm Mở Khóa Lẻ
                  </h3>
                  <p className="text-sm text-zinc-400 mt-1">
                    Số dư tạm tính: <span className="font-bold text-neonGreen">{tempBalance.toLocaleString()}đ</span>
                  </p>
                </div>
                <button onClick={() => setIsProductModalOpen(false)} className="text-zinc-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="p-3 border-b border-zinc-800">
                <input
                  type="text"
                  placeholder="Tìm kiếm sản phẩm theo tên hoặc ID..."
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-white focus:outline-none focus:border-neonPurple"
                />
              </div>
              
              <div className="overflow-y-auto p-4 space-y-3 flex-1">
                {filteredProducts.length === 0 ? (
                  <p className="text-center text-zinc-500 py-8">Không tìm thấy sản phẩm nào phù hợp.</p>
                ) : (
                  filteredProducts.map(prod => {
                    const isSelected = selectedProductIds.includes(prod.id);
                    const canAfford = tempBalance >= prod.price;
                    const isDisabled = !isSelected && !canAfford;

                    return (
                      <div key={prod.id} 
                        onClick={() => {
                          if (isSelected) {
                            setSelectedProductIds(prev => prev.filter(id => id !== prod.id));
                          } else if (canAfford) {
                            setSelectedProductIds(prev => [...prev, prod.id]);
                          }
                        }} 
                        className={`flex items-center gap-4 p-3 border rounded-xl cursor-pointer transition group ${isSelected ? 'bg-neonPurple/10 border-neonPurple' : isDisabled ? 'bg-red-500/5 border-red-500/20 opacity-75' : 'bg-zinc-900/50 border-zinc-800 hover:border-neonPurple hover:bg-zinc-900'}`}
                      >
                        <div className="shrink-0 flex items-center justify-center w-5 h-5 rounded border border-zinc-600 bg-zinc-900 ml-1">
                          {isSelected && <CheckSquare className="w-4 h-4 text-neonPurple" />}
                          {!isSelected && !isDisabled && <Square className="w-4 h-4 text-zinc-600" />}
                          {!isSelected && isDisabled && <Square className="w-4 h-4 text-red-500/30" />}
                        </div>
                        <img src={prod.imageUrl} alt={prod.name} className="w-12 h-12 rounded bg-zinc-800 object-cover shrink-0" />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-white truncate">{prod.name}</h4>
                          <p className="text-xs text-zinc-500 font-mono">{prod.id}</p>
                        </div>
                        <div className="text-right shrink-0 pr-2">
                          <p className={`font-bold ${isDisabled ? 'text-red-400' : 'text-neonGreen'}`}>{prod.price.toLocaleString()}đ</p>
                          {isDisabled && <p className="text-xs text-red-500">Thiếu số dư</p>}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              <div className="p-4 border-t border-zinc-800 bg-zinc-900 flex justify-between items-center">
                <span className="text-sm text-zinc-400">Đã chọn: <strong className="text-white">{selectedProductIds.length}</strong> sản phẩm</span>
                <button 
                  onClick={() => {
                    if (!editingUser) return;
                    const newPurchased = selectedProductIds.map(id => ({ id, expiresAt: "" }));
                    setEditingUser({
                      ...editingUser,
                      purchasedProducts: [...editingUser.purchasedProducts, ...newPurchased]
                    });
                    setIsProductModalOpen(false);
                  }}
                  disabled={selectedProductIds.length === 0}
                  className="bg-neonPurple hover:bg-neonPurple-dark text-white px-6 py-2 rounded-lg font-bold disabled:opacity-50 transition"
                >
                  Xác Nhận Thêm
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
