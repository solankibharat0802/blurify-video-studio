import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Edit, Plus, Trash2 } from "lucide-react";

interface UserSubscription {
  id: string;
  email: string;
  full_name: string;
  plan_type: string;
  status: string;
  conversions_limit: number;
  conversions_used: number;
}

interface Coupon {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  usage_limit: number | null;
  used_count: number;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  stripe_coupon_id: string | null;
}

export function AdminSubscriptionManager() {
  const [users, setUsers] = useState<UserSubscription[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserSubscription | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form states
  const [editForm, setEditForm] = useState({
    plan_type: '',
    conversions_limit: '',
    conversions_used: '',
    status: ''
  });

  const [couponForm, setCouponForm] = useState({
    code: '',
    discount_type: 'percentage',
    discount_value: '',
    usage_limit: '',
    valid_until: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([fetchUsers(), fetchCoupons()]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    const { data: usersData, error } = await supabase
      .from('profiles')
      .select(`
        id,
        user_id,
        email,
        full_name
      `);

    if (error) throw error;

    const { data: subscriptionsData } = await supabase
      .from('subscriptions')
      .select('*');

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
        plan_type: subscription?.plan_type || 'free',
        status: subscription?.status || 'inactive',
        conversions_limit: subscription?.conversions_limit || 0,
        conversions_used: subscription?.conversions_used || 0,
      };
    }) || [];

    setUsers(formattedUsers);
  };

  const fetchCoupons = async () => {
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    setCoupons(data || []);
  };

  const openEditModal = (user: UserSubscription) => {
    setSelectedUser(user);
    setEditForm({
      plan_type: user.plan_type,
      conversions_limit: user.conversions_limit.toString(),
      conversions_used: user.conversions_used.toString(),
      status: user.status
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateSubscription = async () => {
    if (!selectedUser) return;

    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({
          plan_type: editForm.plan_type,
          conversions_limit: parseInt(editForm.conversions_limit),
          conversions_used: parseInt(editForm.conversions_used),
          status: editForm.status
        })
        .eq('user_id', selectedUser.id);

      if (error) throw error;

      toast.success('Subscription updated successfully');
      setIsEditModalOpen(false);
      fetchUsers();
    } catch (error) {
      console.error('Error updating subscription:', error);
      toast.error('Failed to update subscription');
    }
  };

  const handleCreateCoupon = async () => {
    try {
      const validUntil = couponForm.valid_until ? new Date(couponForm.valid_until).toISOString() : null;
      
      const { error } = await supabase
        .from('coupons')
        .insert({
          code: couponForm.code.toUpperCase(),
          discount_type: couponForm.discount_type,
          discount_value: parseFloat(couponForm.discount_value),
          usage_limit: couponForm.usage_limit ? parseInt(couponForm.usage_limit) : null,
          valid_until: validUntil
        });

      if (error) throw error;

      toast.success('Coupon created successfully');
      setIsCouponModalOpen(false);
      setCouponForm({
        code: '',
        discount_type: 'percentage',
        discount_value: '',
        usage_limit: '',
        valid_until: ''
      });
      fetchCoupons();
    } catch (error) {
      console.error('Error creating coupon:', error);
      toast.error('Failed to create coupon');
    }
  };

  const handleToggleCoupon = async (couponId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('coupons')
        .update({ is_active: !isActive })
        .eq('id', couponId);

      if (error) throw error;

      toast.success(`Coupon ${!isActive ? 'activated' : 'deactivated'}`);
      fetchCoupons();
    } catch (error) {
      console.error('Error toggling coupon:', error);
      toast.error('Failed to update coupon');
    }
  };

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCouponForm(prev => ({ ...prev, code: result }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <div className="animate-pulse">Loading subscription data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Subscription Management */}
      <Card>
        <CardHeader>
          <CardTitle>Subscription Management</CardTitle>
          <CardDescription>
            Manage user subscriptions, limits, and usage
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
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{user.full_name}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
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
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditModal(user)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Coupon Management */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle>Coupon Management</CardTitle>
            <CardDescription>
              Create and manage discount coupons
            </CardDescription>
          </div>
          <Dialog open={isCouponModalOpen} onOpenChange={setIsCouponModalOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Coupon
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Coupon</DialogTitle>
                <DialogDescription>
                  Generate a discount coupon for users
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label htmlFor="code">Coupon Code</Label>
                    <Input
                      id="code"
                      value={couponForm.code}
                      onChange={(e) => setCouponForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                      placeholder="DISCOUNT10"
                    />
                  </div>
                  <Button type="button" variant="outline" onClick={generateRandomCode} className="mt-6">
                    Generate
                  </Button>
                </div>
                
                <div>
                  <Label htmlFor="discount_type">Discount Type</Label>
                  <Select value={couponForm.discount_type} onValueChange={(value) => setCouponForm(prev => ({ ...prev, discount_type: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="amount">Fixed Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="discount_value">
                    Discount Value {couponForm.discount_type === 'percentage' ? '(%)' : '($)'}
                  </Label>
                  <Input
                    id="discount_value"
                    type="number"
                    value={couponForm.discount_value}
                    onChange={(e) => setCouponForm(prev => ({ ...prev, discount_value: e.target.value }))}
                    placeholder={couponForm.discount_type === 'percentage' ? '10' : '5.00'}
                  />
                </div>

                <div>
                  <Label htmlFor="usage_limit">Usage Limit (optional)</Label>
                  <Input
                    id="usage_limit"
                    type="number"
                    value={couponForm.usage_limit}
                    onChange={(e) => setCouponForm(prev => ({ ...prev, usage_limit: e.target.value }))}
                    placeholder="100"
                  />
                </div>

                <div>
                  <Label htmlFor="valid_until">Valid Until (optional)</Label>
                  <Input
                    id="valid_until"
                    type="datetime-local"
                    value={couponForm.valid_until}
                    onChange={(e) => setCouponForm(prev => ({ ...prev, valid_until: e.target.value }))}
                  />
                </div>

                <Button onClick={handleCreateCoupon} className="w-full">
                  Create Coupon
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Valid Until</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.map((coupon) => (
                  <TableRow key={coupon.id}>
                    <TableCell className="font-mono">{coupon.code}</TableCell>
                    <TableCell>
                      {coupon.discount_value}{coupon.discount_type === 'percentage' ? '%' : '$'} off
                    </TableCell>
                    <TableCell>
                      {coupon.used_count} / {coupon.usage_limit || '∞'}
                    </TableCell>
                    <TableCell>
                      {coupon.valid_until ? new Date(coupon.valid_until).toLocaleDateString() : 'No expiry'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={coupon.is_active ? 'default' : 'secondary'}>
                        {coupon.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleCoupon(coupon.id, coupon.is_active)}
                      >
                        {coupon.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Subscription Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Subscription</DialogTitle>
            <DialogDescription>
              Modify subscription details for {selectedUser?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="plan_type">Plan Type</Label>
              <Select value={editForm.plan_type} onValueChange={(value) => setEditForm(prev => ({ ...prev, plan_type: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={editForm.status} onValueChange={(value) => setEditForm(prev => ({ ...prev, status: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="past_due">Past Due</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="conversions_limit">Conversions Limit</Label>
              <Input
                id="conversions_limit"
                type="number"
                value={editForm.conversions_limit}
                onChange={(e) => setEditForm(prev => ({ ...prev, conversions_limit: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="conversions_used">Conversions Used</Label>
              <Input
                id="conversions_used"
                type="number"
                value={editForm.conversions_used}
                onChange={(e) => setEditForm(prev => ({ ...prev, conversions_used: e.target.value }))}
              />
            </div>

            <Button onClick={handleUpdateSubscription} className="w-full">
              Update Subscription
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}