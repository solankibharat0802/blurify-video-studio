import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface UserData {
  id: string;
  email: string;
  full_name: string;
  is_admin: boolean;
  conversion_count: number;
  created_at: string;
  conversion_limit: number;
  conversions_used: number;
  subscription_active: boolean;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
}

export function AdminPanel() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingUsers, setEditingUsers] = useState<Record<string, Partial<UserData>>>({});
  const [updatingUsers, setUpdatingUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    checkAdminStatus();
  }, [user]);

  const checkAdminStatus = async () => {
    if (!user) return;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('user_id', user.id)
        .single();

      setIsAdmin(profile?.is_admin || false);
      
      if (profile?.is_admin) {
        fetchUsers();
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      // Update expired subscriptions first
      const { error: updateError } = await supabase.rpc('update_expired_subscriptions');
      if (updateError) {
        console.error('Error updating expired subscriptions:', updateError);
      }

      const { data: usersData, error } = await supabase
        .from('profiles')
        .select(`
          id,
          user_id,
          email,
          full_name,
          is_admin,
          created_at,
          conversion_limit,
          conversions_used,
          subscription_active,
          subscription_start_date,
          subscription_end_date
        `);

      if (error) throw error;

      // Get conversion counts for each user
      const userIds = usersData?.map(u => u.user_id) || [];
      const { data: conversionCounts } = await supabase
        .from('conversion_logs')
        .select('user_id, id')
        .in('user_id', userIds);

      // Count conversions per user
      const conversionCountsMap = conversionCounts?.reduce((acc, log) => {
        acc[log.user_id] = (acc[log.user_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const formattedUsers = usersData?.map((user: any) => {
        return {
          id: user.user_id,
          email: user.email,
          full_name: user.full_name || user.email,
          is_admin: user.is_admin,
          conversion_count: conversionCountsMap[user.user_id] || 0,
          created_at: user.created_at,
          conversion_limit: user.conversion_limit || 5,
          conversions_used: user.conversions_used || 0,
          subscription_active: user.subscription_active || false,
          subscription_start_date: user.subscription_start_date,
          subscription_end_date: user.subscription_end_date,
        };
      }) || [];

      setUsers(formattedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const startEditingUser = (userId: string, userData: UserData) => {
    setEditingUsers(prev => ({
      ...prev,
      [userId]: {
        subscription_active: userData.subscription_active,
        subscription_end_date: userData.subscription_end_date,
        conversion_limit: userData.conversion_limit
      }
    }));
  };

  const updateEditingUser = (userId: string, field: keyof UserData, value: any) => {
    setEditingUsers(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [field]: value
      }
    }));
  };

  const cancelEditingUser = (userId: string) => {
    setEditingUsers(prev => {
      const newState = { ...prev };
      delete newState[userId];
      return newState;
    });
  };

  const saveUserChanges = async (userId: string, userData: UserData) => {
    const changes = editingUsers[userId];
    if (!changes) return;

    setUpdatingUsers(prev => new Set([...prev, userId]));

    try {
      console.log(`Saving changes for user ${userId}:`, changes);
      
      const updates: any = {};
      
      // Handle subscription changes
      if (changes.subscription_active !== undefined) {
        updates.subscription_active = changes.subscription_active;
        
        if (changes.subscription_active) {
          // Activating subscription
          updates.subscription_start_date = new Date().toISOString();
          if (changes.subscription_end_date) {
            updates.subscription_end_date = changes.subscription_end_date;
          } else {
            // Default to 1 month if no end date specified
            const endDate = new Date();
            endDate.setMonth(endDate.getMonth() + 1);
            updates.subscription_end_date = endDate.toISOString();
          }
        } else {
          // Deactivating subscription
          updates.subscription_start_date = null;
          updates.subscription_end_date = null;
        }
      } else if (changes.subscription_end_date) {
        // Just updating end date
        updates.subscription_end_date = changes.subscription_end_date;
        updates.subscription_active = true;
        if (!userData.subscription_start_date) {
          updates.subscription_start_date = new Date().toISOString();
        }
      }

      // Handle conversion limit changes
      if (changes.conversion_limit !== undefined) {
        updates.conversion_limit = changes.conversion_limit;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', userId);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      console.log('User update successful');
      toast.success(`User ${userData.email} updated successfully`);
      
      // Clear editing state for this user
      cancelEditingUser(userId);
      
      // Refresh the data
      await fetchUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Failed to update user');
    } finally {
      setUpdatingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const quickToggleSubscription = async (userId: string, currentStatus: boolean) => {
    try {
      console.log(`Quick toggling subscription for user ${userId}, current status: ${currentStatus}`);
      
      const updates: any = { subscription_active: !currentStatus };
      
      if (!currentStatus) {
        // Activating subscription - set start and end dates
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 1); // 1 month subscription
        
        updates.subscription_start_date = startDate.toISOString();
        updates.subscription_end_date = endDate.toISOString();
        
        console.log('Activating subscription with dates:', updates);
      } else {
        // Deactivating subscription - clear dates
        updates.subscription_start_date = null;
        updates.subscription_end_date = null;
        
        console.log('Deactivating subscription, clearing dates');
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', userId);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      console.log('Subscription toggle successful');
      toast.success(`Subscription ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
      await fetchUsers(); // Refresh the data
    } catch (error) {
      console.error('Error toggling subscription:', error);
      toast.error('Failed to update subscription');
    }
  };

  const quickUpdateDate = async (userId: string, endDate: string) => {
    try {
      console.log(`Quick updating subscription date for user ${userId} to ${endDate}`);
      
      const { error } = await supabase
        .from('profiles')
        .update({ 
          subscription_end_date: endDate,
          subscription_active: true,
          subscription_start_date: new Date().toISOString() // Set start date to now when activating
        })
        .eq('user_id', userId);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      console.log('Subscription date update successful');
      toast.success('Subscription date updated successfully');
      await fetchUsers(); // Refresh the data
    } catch (error) {
      console.error('Error updating subscription date:', error);
      toast.error('Failed to update subscription date');
    }
  };

  if (!user) {
    return <div>Please log in to access the admin panel.</div>;
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">Access denied. Admin privileges required.</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <div className="animate-pulse">Loading admin data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const activeSubscriptions = users.filter(u => u.subscription_active).length;
  const freeUsers = users.filter(u => !u.subscription_active).length;
  const totalConversions = users.reduce((sum, u) => sum + u.conversion_count, 0);

  return (
    <div className="w-full">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{users.length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Conversions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalConversions}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{activeSubscriptions}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Free Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{freeUsers}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                Manage user subscriptions and conversion limits
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Conversions</TableHead>
                      <TableHead>Conversion Limit</TableHead>
                      <TableHead>Subscription</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Quick Actions</TableHead>
                      <TableHead>Update</TableHead>
                      <TableHead>Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((userData) => {
                      const isEditing = editingUsers[userData.id];
                      const isUpdating = updatingUsers.has(userData.id);
                      const hasChanges = Boolean(isEditing);

                      return (
                        <TableRow key={userData.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{userData.full_name}</div>
                              <div className="text-sm text-muted-foreground">{userData.email}</div>
                              {userData.is_admin && <Badge variant="outline" className="text-xs">Admin</Badge>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <span className={userData.conversions_used >= userData.conversion_limit && !userData.subscription_active ? 'text-red-600 font-semibold' : ''}>
                                {userData.conversions_used}/{userData.subscription_active ? '∞' : userData.conversion_limit}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <input
                                type="number"
                                value={isEditing.conversion_limit ?? userData.conversion_limit}
                                onChange={(e) => updateEditingUser(userData.id, 'conversion_limit', parseInt(e.target.value))}
                                className="w-20 text-sm border rounded px-2 py-1 bg-background"
                                min="1"
                                max="100"
                              />
                            ) : (
                              <span className="text-sm">{userData.conversion_limit}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={isEditing ? isEditing.subscription_active ?? userData.subscription_active : userData.subscription_active}
                                onCheckedChange={(checked) => {
                                  if (!isEditing) {
                                    startEditingUser(userData.id, userData);
                                  }
                                  updateEditingUser(userData.id, 'subscription_active', checked);
                                }}
                              />
                              <span className={(isEditing ? isEditing.subscription_active ?? userData.subscription_active : userData.subscription_active) ? 'text-green-600 font-semibold' : 'text-gray-500'}>
                                {(isEditing ? isEditing.subscription_active ?? userData.subscription_active : userData.subscription_active) ? 'Active' : 'Free'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-2">
                              {(isEditing ? isEditing.subscription_active ?? userData.subscription_active : userData.subscription_active) ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="datetime-local"
                                    value={isEditing && isEditing.subscription_end_date 
                                      ? new Date(isEditing.subscription_end_date).toISOString().slice(0, 16)
                                      : userData.subscription_end_date 
                                        ? new Date(userData.subscription_end_date).toISOString().slice(0, 16) 
                                        : ''
                                    }
                                    onChange={(e) => {
                                      if (!isEditing) {
                                        startEditingUser(userData.id, userData);
                                      }
                                      updateEditingUser(userData.id, 'subscription_end_date', new Date(e.target.value).toISOString());
                                    }}
                                    className="text-sm border rounded px-2 py-1 w-44 bg-background"
                                  />
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="datetime-local"
                                    value={isEditing && isEditing.subscription_end_date 
                                      ? new Date(isEditing.subscription_end_date).toISOString().slice(0, 16)
                                      : ''
                                    }
                                    onChange={(e) => {
                                      if (!isEditing) {
                                        startEditingUser(userData.id, userData);
                                      }
                                      if (e.target.value) {
                                        updateEditingUser(userData.id, 'subscription_end_date', new Date(e.target.value).toISOString());
                                      }
                                    }}
                                    className="text-sm border rounded px-2 py-1 w-44 bg-background"
                                    placeholder="Set end date"
                                  />
                                  <span className="text-xs text-gray-500">Set date</span>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const endDate = new Date();
                                  endDate.setMonth(endDate.getMonth() + 1);
                                  quickUpdateDate(userData.id, endDate.toISOString());
                                }}
                                disabled={isUpdating}
                              >
                                +1 Month
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const endDate = new Date();
                                  endDate.setFullYear(endDate.getFullYear() + 1);
                                  quickUpdateDate(userData.id, endDate.toISOString());
                                }}
                                disabled={isUpdating}
                              >
                                +1 Year
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-2">
                              {hasChanges ? (
                                <>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => saveUserChanges(userData.id, userData)}
                                    disabled={isUpdating}
                                    className="bg-green-600 hover:bg-green-700"
                                  >
                                    {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => cancelEditingUser(userData.id)}
                                    disabled={isUpdating}
                                  >
                                    Cancel
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => startEditingUser(userData.id, userData)}
                                  disabled={isUpdating}
                                >
                                  Edit
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {new Date(userData.created_at).toLocaleDateString()}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              
              <div className="mt-4 flex justify-end">
                <Button onClick={fetchUsers} variant="outline">
                  Refresh Data
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
    </div>
  );
}