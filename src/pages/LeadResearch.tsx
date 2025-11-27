import { useState } from 'react';
import SEO from '@/components/SEO';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserSearch, Linkedin, Building2, User, Loader2, RefreshCw, ExternalLink, Clock } from 'lucide-react';
import { useLeadResearch } from '@/hooks/useLeadResearch';
import LeadResearchDetail from '@/components/lead-research/LeadResearchDetail';

export default function LeadResearch() {
  const [inputType, setInputType] = useState<'salesforce' | 'linkedin' | 'manual'>('salesforce');
  const [salesforceUrl, setSalesforceUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [manualData, setManualData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    title: '',
    companyName: '',
    companyWebsite: ''
  });
  const [selectedResearchId, setSelectedResearchId] = useState<string | null>(null);

  const { researchList, isLoading, startResearch, isStarting } = useLeadResearch();

  const handleSubmit = async () => {
    if (inputType === 'salesforce' && salesforceUrl) {
      await startResearch({ inputType: 'salesforce', inputUrl: salesforceUrl });
      setSalesforceUrl('');
    } else if (inputType === 'linkedin' && linkedinUrl) {
      await startResearch({ inputType: 'linkedin', inputUrl: linkedinUrl });
      setLinkedinUrl('');
    } else if (inputType === 'manual') {
      await startResearch({ 
        inputType: 'manual', 
        manualData: {
          firstName: manualData.firstName,
          lastName: manualData.lastName,
          email: manualData.email,
          title: manualData.title,
          companyName: manualData.companyName,
          companyWebsite: manualData.companyWebsite
        }
      });
      setManualData({ firstName: '', lastName: '', email: '', title: '', companyName: '', companyWebsite: '' });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'researching':
        return <Badge variant="default" className="animate-pulse">Researching...</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getInputIcon = (type: string) => {
    switch (type) {
      case 'salesforce':
        return <Building2 className="h-4 w-4" />;
      case 'linkedin':
        return <Linkedin className="h-4 w-4" />;
      case 'manual':
        return <User className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="Lead Research | Sentra"
        description="Research leads from Salesforce, LinkedIn, or manual input"
      />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <UserSearch className="h-8 w-8" />
            Lead Research
          </h1>
          <p className="text-muted-foreground mt-2">
            Research leads from Salesforce, LinkedIn, or enter details manually
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Input Section */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>New Research</CardTitle>
              <CardDescription>Enter a URL or lead details to start research</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={inputType} onValueChange={(v) => setInputType(v as any)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="salesforce">Salesforce</TabsTrigger>
                  <TabsTrigger value="linkedin">LinkedIn</TabsTrigger>
                  <TabsTrigger value="manual">Manual</TabsTrigger>
                </TabsList>
                
                <TabsContent value="salesforce" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="sf-url">Salesforce URL</Label>
                    <Input
                      id="sf-url"
                      placeholder="https://yourcompany.salesforce.com/..."
                      value={salesforceUrl}
                      onChange={(e) => setSalesforceUrl(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Paste a Lead, Contact, or Account URL
                    </p>
                  </div>
                </TabsContent>
                
                <TabsContent value="linkedin" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="li-url">LinkedIn Profile URL</Label>
                    <Input
                      id="li-url"
                      placeholder="https://linkedin.com/in/..."
                      value={linkedinUrl}
                      onChange={(e) => setLinkedinUrl(e.target.value)}
                    />
                  </div>
                </TabsContent>
                
                <TabsContent value="manual" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        value={manualData.firstName}
                        onChange={(e) => setManualData({...manualData, firstName: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        value={manualData.lastName}
                        onChange={(e) => setManualData({...manualData, lastName: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={manualData.email}
                      onChange={(e) => setManualData({...manualData, email: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="title">Job Title</Label>
                    <Input
                      id="title"
                      value={manualData.title}
                      onChange={(e) => setManualData({...manualData, title: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input
                      id="companyName"
                      value={manualData.companyName}
                      onChange={(e) => setManualData({...manualData, companyName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyWebsite">Company Website</Label>
                    <Input
                      id="companyWebsite"
                      placeholder="https://..."
                      value={manualData.companyWebsite}
                      onChange={(e) => setManualData({...manualData, companyWebsite: e.target.value})}
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <Button 
                className="w-full mt-6" 
                onClick={handleSubmit}
                disabled={isStarting || (inputType === 'salesforce' && !salesforceUrl) || (inputType === 'linkedin' && !linkedinUrl) || (inputType === 'manual' && !manualData.firstName && !manualData.companyName)}
              >
                {isStarting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Starting Research...
                  </>
                ) : (
                  <>
                    <UserSearch className="h-4 w-4 mr-2" />
                    Start Research
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Research History */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Research History</CardTitle>
              <CardDescription>Your previously researched leads</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : researchList.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <UserSearch className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No research history yet</p>
                  <p className="text-sm">Start by entering a URL or lead details</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {researchList.map((research) => (
                      <Card 
                        key={research.id} 
                        className="cursor-pointer hover:bg-accent/50 transition-colors"
                        onClick={() => setSelectedResearchId(research.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <div className="mt-1">
                                {getInputIcon(research.input_type)}
                              </div>
                              <div>
                                <h4 className="font-medium">
                                  {research.full_name || `${research.first_name || ''} ${research.last_name || ''}`.trim() || 'Unknown'}
                                </h4>
                                {research.title && (
                                  <p className="text-sm text-muted-foreground">{research.title}</p>
                                )}
                                {research.company_name && (
                                  <p className="text-sm text-muted-foreground">{research.company_name}</p>
                                )}
                                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {new Date(research.created_at).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {getStatusBadge(research.status)}
                              <ExternalLink className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Research Detail Sheet */}
      <LeadResearchDetail 
        researchId={selectedResearchId}
        open={!!selectedResearchId}
        onOpenChange={(open) => !open && setSelectedResearchId(null)}
      />
    </div>
  );
}
