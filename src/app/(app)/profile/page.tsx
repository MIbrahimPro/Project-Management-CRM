"use client";

import { useEffect, useRef, useState } from "react";
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  type Crop,
  type PixelCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Camera, RotateCw } from "lucide-react";
import toast from "react-hot-toast";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { InlineEditField } from "@/components/ui/InlineEditField";
import { useInlineEdit } from "@/hooks/useInlineEdit";

// ---- Types ----

type ProfileData = {
  id: string;
  name: string;
  email: string;
  role: string;
  profilePicUrl: string | null;
  avatarSignedUrl: string | null;
  phone: string | null;
  workMode: string | null;
  statedRole: string | null;
  isGoogleConnected: boolean;
  currencyPreference: string;
  createdAt: string;
};

// ---- Crop helpers ----

function toCenteredSquareCrop(w: number, h: number): Crop {
  return centerCrop(makeAspectCrop({ unit: "%", width: 90 }, 1, w, h), w, h);
}

async function buildCroppedBlob(params: {
  imageDataUrl: string;
  crop: PixelCrop;
  zoom: number;
  rotation: number;
}): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Failed to load image"));
    el.src = params.imageDataUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(params.crop.width));
  canvas.height = Math.max(1, Math.floor(params.crop.height));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");

  const scaleX = img.naturalWidth / img.width;
  const scaleY = img.naturalHeight / img.height;
  const cropX = params.crop.x * scaleX;
  const cropY = params.crop.y * scaleY;
  const cropW = params.crop.width * scaleX;
  const cropH = params.crop.height * scaleY;

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((params.rotation * Math.PI) / 180);
  ctx.scale(params.zoom, params.zoom);
  ctx.translate(-cropX - cropW / 2, -cropY - cropH / 2);
  ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
  ctx.restore();

  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, "image/jpeg", 0.92)
  );
  if (!blob) throw new Error("Failed to generate cropped image");
  return blob;
}

// ---- Page ----

export default function ProfilePage() {
  // State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);

  // Crop modal
  const [modalOpen, setModalOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [cropError, setCropError] = useState<string | null>(null);

  // Load profile
  useEffect(() => {
    fetch("/api/users/me")
      .then((r) => r.json())
      .then((d: { data?: ProfileData; error?: string }) => {
        if (!d.data) throw new Error(d.error ?? "Failed to load profile");
        setProfile(d.data);
      })
      .catch((e: unknown) => {
        setLoadError(e instanceof Error ? e.message : "Could not load profile");
      })
      .finally(() => setLoading(false));
  }, []);

  // Inline edit — name
  const nameEdit = useInlineEdit(profile?.name ?? "", async (name) => {
    const res = await fetch("/api/users/me/name", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const d = (await res.json()) as { error?: string; data?: { name: string } };
    if (!res.ok) return { error: d.error ?? "Failed to update name" };
    setProfile((p) => (p ? { ...p, name: d.data?.name ?? name } : p));
    toast.success("Name updated", { style: { background: "hsl(var(--b2))", color: "hsl(var(--bc))" } });
    return {};
  });

  // Inline edit — phone
  const phoneEdit = useInlineEdit(profile?.phone ?? "", async (phone) => {
    const normalized = phone.trim() || null;
    const res = await fetch("/api/users/me/phone", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: normalized }),
    });
    const d = (await res.json()) as { error?: string; data?: { phone: string | null } };
    if (!res.ok) return { error: d.error ?? "Failed to update phone" };
    setProfile((p) => (p ? { ...p, phone: d.data?.phone ?? normalized } : p));
    toast.success("Phone updated", { style: { background: "hsl(var(--b2))", color: "hsl(var(--bc))" } });
    return {};
  });

  // Sync inline edit values once profile loads
  useEffect(() => {
    if (profile) {
      nameEdit.syncValue(profile.name);
      phoneEdit.syncValue(profile.phone ?? "");
    }
    // Only sync on initial profile load, not on every profile mutation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  // ---- Avatar handlers ----

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image exceeds 5MB limit", { style: { background: "hsl(var(--b2))", color: "hsl(var(--er))" } });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImageSrc(reader.result);
        setZoom(1);
        setRotation(0);
        setCrop(undefined);
        setCompletedCrop(undefined);
        setCropError(null);
        setModalOpen(true);
      }
    };
    reader.readAsDataURL(file);
    // Reset so the same file can be re-selected
    e.target.value = "";
  }

  function closeModal() {
    setModalOpen(false);
    setImageSrc(null);
    setCropError(null);
  }

  async function handleUpload() {
    if (!imageSrc || !completedCrop) {
      setCropError("Please crop the image first.");
      return;
    }
    setCropError(null);
    setUploading(true);
    try {
      const blob = await buildCroppedBlob({
        imageDataUrl: imageSrc,
        crop: completedCrop,
        zoom,
        rotation,
      });
      const formData = new FormData();
      formData.append("avatar", new File([blob], "avatar.jpg", { type: "image/jpeg" }));

      const res = await fetch("/api/users/me/avatar", { method: "POST", body: formData, credentials: "include" });
      const d = (await res.json()) as {
        error?: string;
        data?: { profilePicUrl: string; avatarSignedUrl?: string };
      };
      if (!res.ok) throw new Error(d.error ?? "Upload failed");

      setProfile((p) =>
        p
          ? {
              ...p,
              profilePicUrl: d.data?.profilePicUrl ?? null,
              avatarSignedUrl: d.data?.avatarSignedUrl ?? p.avatarSignedUrl,
            }
          : p
      );
      closeModal();
      toast.success("Profile picture updated", { style: { background: "hsl(var(--b2))", color: "hsl(var(--bc))" } });
    } catch (e) {
      setCropError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  // ---- Render ----

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="skeleton h-8 w-32" />
        <div className="card bg-base-200 border border-base-300">
          <div className="card-body items-center py-8 gap-4">
            <div className="skeleton w-32 h-32 rounded-full" />
            <div className="skeleton h-6 w-40" />
            <div className="skeleton h-4 w-24" />
          </div>
        </div>
        <div className="card bg-base-200 border border-base-300">
          <div className="card-body gap-3">
            <div className="skeleton h-4 w-32" />
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton h-10 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="alert alert-error max-w-2xl mx-auto">
        <span>{loadError ?? "Failed to load profile."}</span>
      </div>
    );
  }

  const roleLabel = profile.role.toLowerCase().replace(/_/g, " ");
  const workModeLabel = profile.workMode?.toLowerCase() ?? null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-base-content">Profile</h1>
        <p className="text-sm text-base-content/60">Manage your personal information and avatar.</p>
      </div>

      {/* Avatar + name card */}
      <div className="card bg-base-200 shadow-sm border border-base-300">
        <div className="card-body items-center py-8 gap-4">
          {/* Avatar with hover overlay */}
          <div
            className="relative group cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <UserAvatar user={{ name: profile.name, profilePicUrl: profile.profilePicUrl }} size={96} />
            <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera className="w-7 h-7 text-white" />
            </div>
          </div>
          <input
            ref={fileInputRef}
            id="avatar-input"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={onFileSelected}
          />

          {/* Name inline edit */}
          <div className="flex flex-col items-center gap-2">
            <InlineEditField
              value={nameEdit.value}
              editingValue={nameEdit.editingValue}
              isEditing={nameEdit.isEditing}
              isSaving={nameEdit.isSaving}
              error={nameEdit.error}
              onStartEdit={nameEdit.startEdit}
              onCancel={nameEdit.cancelEdit}
              onSave={() => void nameEdit.saveEdit()}
              onChange={nameEdit.setEditingValue}
              displayClassName="text-xl font-semibold justify-center"
            />
            <div className="flex flex-wrap gap-2 justify-center">
              <span className="badge badge-primary capitalize">{roleLabel}</span>
              {workModeLabel && (
                <span className="badge badge-outline capitalize">{workModeLabel}</span>
              )}
            </div>
            {profile.statedRole && (
              <span className="text-sm text-base-content/60">{profile.statedRole}</span>
            )}
          </div>
        </div>
      </div>

      {/* Account details card */}
      <div className="card bg-base-200 shadow-sm border border-base-300">
        <div className="card-body gap-0">
          <h2 className="font-semibold text-base-content mb-4">Account Details</h2>

          <div className="flex items-center justify-between py-3 border-b border-base-300">
            <span className="text-sm text-base-content/60 w-32 shrink-0">Phone</span>
            <div className="flex-1">
              <InlineEditField
                value={phoneEdit.value}
                editingValue={phoneEdit.editingValue}
                isEditing={phoneEdit.isEditing}
                isSaving={phoneEdit.isSaving}
                error={phoneEdit.error}
                placeholder="Add phone number"
                inputType="tel"
                onStartEdit={phoneEdit.startEdit}
                onCancel={phoneEdit.cancelEdit}
                onSave={() => void phoneEdit.saveEdit()}
                onChange={phoneEdit.setEditingValue}
              />
            </div>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-base-300">
            <span className="text-sm text-base-content/60 w-32 shrink-0">Email</span>
            <span className="text-base-content flex-1">{profile.email}</span>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-base-300">
            <span className="text-sm text-base-content/60 w-32 shrink-0">Role</span>
            <span className="text-base-content flex-1 capitalize">{roleLabel}</span>
          </div>

          {workModeLabel && (
            <div className="flex items-center justify-between py-3 border-b border-base-300">
              <span className="text-sm text-base-content/60 w-32 shrink-0">Work Mode</span>
              <span className="text-base-content flex-1 capitalize">{workModeLabel}</span>
            </div>
          )}

          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-base-content/60 w-32 shrink-0">Member since</span>
            <span className="text-base-content flex-1">
              {new Date(profile.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Avatar crop modal */}
      <dialog className={`modal ${modalOpen ? "modal-open" : ""}`}>
        <div className="modal-box bg-base-200 max-w-lg w-full">
          <h3 className="font-bold text-lg text-base-content mb-4">Update Profile Picture</h3>

          {imageSrc ? (
            <div className="space-y-4">
              {/* Crop area */}
              <div className="flex justify-center bg-base-300 rounded-lg p-4 overflow-hidden">
                <ReactCrop
                  crop={crop}
                  onChange={(c) => setCrop(c)}
                  onComplete={(c) => setCompletedCrop(c)}
                  aspect={1}
                  circularCrop={false}
                >
                  <img
                    src={imageSrc}
                    alt="Crop preview"
                    className="max-h-[320px] w-full object-contain"
                    style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
                    onLoad={(e) => {
                      const t = e.currentTarget;
                      setCrop(toCenteredSquareCrop(t.width, t.height));
                    }}
                  />
                </ReactCrop>
              </div>

              {/* Zoom + rotate */}
              <div className="grid grid-cols-2 gap-4">
                <label className="form-control gap-1">
                  <span className="label-text text-xs text-base-content/60">Zoom</span>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.05}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="range range-sm"
                  />
                </label>
                <div className="form-control gap-1">
                  <span className="label-text text-xs text-base-content/60">Rotate</span>
                  <div className="flex items-center gap-2">
                    <button
                      className="btn btn-sm btn-outline gap-1"
                      onClick={() => setRotation((r) => (r + 90) % 360)}
                    >
                      <RotateCw className="w-4 h-4" />
                      {rotation}°
                    </button>
                  </div>
                </div>
              </div>

              {cropError && <p className="text-error text-sm">{cropError}</p>}

              <div className="modal-action gap-2">
                <button className="btn btn-ghost" onClick={closeModal} disabled={uploading}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => void handleUpload()}
                  disabled={uploading || !completedCrop}
                >
                  {uploading && <span className="loading loading-spinner loading-sm" />}
                  Save Picture
                </button>
              </div>
            </div>
          ) : (
            <div
              className="border-2 border-dashed border-base-content/20 rounded-xl p-12 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="w-12 h-12 text-base-content/30 mx-auto mb-3" />
              <p className="text-base-content/60 text-sm">Click to choose a photo</p>
              <p className="text-base-content/40 text-xs mt-1">JPG, PNG, WebP, GIF — max 5MB</p>
            </div>
          )}
        </div>
        <div className="modal-backdrop" onClick={closeModal} />
      </dialog>
    </div>
  );
}
