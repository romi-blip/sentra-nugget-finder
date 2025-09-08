import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface SalesforceStatusCounts {
  existing_customer: number;
  existing_opportunity: number;
  existing_contact: number;
  existing_account: number;
  existing_lead: number;
  net_new: number;
  failed: number;
  pending: number;
}

export function useSalesforceStatusCounts(eventId: string) {
  return useQuery<SalesforceStatusCounts>({
    queryKey: ['salesforce-status-counts', eventId],
    queryFn: async (): Promise<SalesforceStatusCounts> => {
      const { data, error } = await supabase
        .from('event_leads')
        .select('sf_existing_customer, sf_existing_opportunity, sf_existing_contact, sf_existing_account, sf_existing_lead, salesforce_status')
        .eq('event_id', eventId);

      if (error) {
        throw new Error(error.message);
      }

      const counts: SalesforceStatusCounts = {
        existing_customer: 0,
        existing_opportunity: 0,
        existing_contact: 0,
        existing_account: 0,
        existing_lead: 0,
        net_new: 0,
        failed: 0,
        pending: 0,
      };

      data?.forEach((lead) => {
        // Apply the same logic as deriveSalesforceStatus function
        if (lead.salesforce_status === 'failed') {
          counts.failed++;
        } else if (lead.sf_existing_customer) {
          counts.existing_customer++;
        } else if (lead.sf_existing_opportunity) {
          counts.existing_opportunity++;
        } else if (lead.sf_existing_contact) {
          counts.existing_contact++;
        } else if (lead.sf_existing_account) {
          counts.existing_account++;
        } else if (lead.sf_existing_lead) {
          counts.existing_lead++;
        } else if (lead.salesforce_status === 'completed') {
          counts.net_new++;
        } else {
          counts.pending++;
        }
      });

      return counts;
    },
    enabled: !!eventId,
  });
}