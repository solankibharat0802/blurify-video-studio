import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface UserData {
  id: string;
  email: string;
  full_name: string;
  is_admin: boolean;
  plan_type: string;
  status: string;
  conversions_limit: number;
  conversions_used: number;
  conversion_count: number;
  created_at: string;
}

export function AdminPanel() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

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
      const { data: usersData, error } = await supabase
        .from('profiles')
        .select(`
          id,
          user_id,
          email,
          full_name,
          is_admin,
          created_at
        `);

      if (error) throw error;

      // Get subscriptions data separately
      const { data: subscriptionsData } = await supabase
        .from('subscriptions')
        .select('*');

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

      // Create subscriptions map
      const subscriptionsMap = subscriptionsData?.reduce((acc, sub) => {
        acc[sub.user_id] = sub;
        return acc;
      }, {} as Record<string, any>) || {};

      const formattedUsers = usersData?.map((user: any) => {
        const subscription = subscriptionsMap[user.user_id];
        return {
          id: user.user_id,
          email: user.email,
          full_name: user.full_name || user.email,
          is_admin: user.is_admin,
          plan_type: subscription?.plan_type || 'free',
          status: subscription?.status || 'inactive',
          conversions_limit: subscription?.conversions_limit || 0,
          conversions_used: subscription?.conversions_used || 0,
          conversion_count: conversionCountsMap[user.user_id] || 0,
          created_at: user.created_at,
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

  return (
    <div className="w-full">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <CardTitle className="text-sm font-medium">Pro Subscribers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {users.filter(u => u.plan_type === 'pro' && u.status === 'active').length}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Conversions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {users.reduce((sum, u) => sum + u.conversion_count, 0)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Users & Subscriptions</CardTitle>
              <CardDescription>
                Overview of user subscriptions and conversion usage
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Conversions</TableHead>
                      <TableHead>Usage</TableHead>
                      <TableHead>Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{user.full_name}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                            {user.is_admin && <Badge variant="outline" className="text-xs">Admin</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.plan_type === 'pro' ? 'default' : 'secondary'}>
                            {user.plan_type.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                            {user.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {user.conversions_used} / {user.conversions_limit}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {user.conversion_count} total
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {new Date(user.created_at).toLocaleDateString()}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
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