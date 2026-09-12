import { getAllConfig } from "@/lib/config";
import SettingsForm from "./SettingsForm";
import WhatsAppWebhookSetup from "./WhatsAppWebhookSetup";

export default async function SettingsPage() {
  const config = await getAllConfig();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">NFR-26 — allow-lists, caps, thresholds, TTLs and feature flags, changeable without a redeploy.</p>
      </div>
      <WhatsAppWebhookSetup />
      <SettingsForm config={config} />
    </div>
  );
}
