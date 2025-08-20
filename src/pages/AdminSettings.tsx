import React from 'react';
import { useNavigate } from 'react-router-dom';
import SEO from '@/components/SEO';
import WebhookSettingsDialog from '@/components/settings/WebhookSettingsDialog';

const AdminSettings: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto p-6">
      <SEO 
        title="Admin Settings - Webhook Configuration"
        description="Manage global webhook settings for all users"
        canonicalPath="/admin/settings"
      />
      <h1 className="text-3xl font-bold mb-4">Admin Settings</h1>
      <p className="text-muted-foreground mb-6">
        Configure global webhooks. These settings apply to all users.
      </p>
      {/* Reuse existing dialog component to manage webhooks */}
      <WebhookSettingsDialog open={true} onOpenChange={(open) => { if (!open) navigate(-1); }} />
    </div>
  );
};

export default AdminSettings;