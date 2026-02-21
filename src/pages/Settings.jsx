import React, { useState, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import {
  Settings as SettingsIcon, Users,
  Plus, Edit, Trash2, Save, Loader2, MoreVertical, LogOut,
  Palette, Briefcase, Plug, SlidersHorizontal,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import EmptyState from "@/components/shared/EmptyState";
import GeneralSettingsTab from "@/components/settings/GeneralSettingsTab";
import CustomizationTab from "@/components/settings/CustomizationTab";
import JobTypesTab from "@/components/settings/JobTypesTab";
import IntegrationsTab from "@/components/settings/IntegrationsTab";

const roleLabels = {
  admin: 'מנהל',
  technician: 'טכנאי',
  office: 'משרד',
  owner: 'מנהל'
};

export default function Settings() {
  const { user, isLoadingAuth, logout } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [configs, setConfigs] = useState([]);

  // Employee dialog
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [employeeForm, setEmployeeForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    role: 'technician',
    status: 'active'
  });
  const [savingEmployee, setSavingEmployee] = useState(false);

  // Delete dialogs
  const [deleteEmployeeDialogOpen, setDeleteEmployeeDialogOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    try {
      const [employeesRes, configsRes] = await Promise.all([
        supabase
          .from('employees')
          .select('*')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('app_configs')
          .select('*')
          .eq('owner_id', user.id),
      ]);

      if (employeesRes.error) throw employeesRes.error;
      if (configsRes.error) throw configsRes.error;

      setConfigs(configsRes.data || []);

      const normalizedEmployees = (employeesRes.data || []).map((row) => ({
        id: row.id,
        full_name: row.name || '',
        phone: row.phone || '',
        email: row.email || '',
        role: row.role === 'owner' ? 'admin' : (row.role || 'technician'),
        status: row.is_active === false ? 'inactive' : 'active'
      }));

      if (normalizedEmployees.length === 0) {
        const seedName = user.user_metadata?.full_name || user.email || 'Owner';
        const { data: seededEmployee, error: seedError } = await supabase
          .from('employees')
          .insert([{
            owner_id: user.id,
            name: seedName,
            phone: user.user_metadata?.phone || '',
            email: user.email || '',
            role: 'admin',
            is_active: true
          }])
          .select('*')
          .single();
        if (seedError) throw seedError;
        setEmployees([{
          id: seededEmployee.id,
          full_name: seededEmployee.name || '',
          phone: seededEmployee.phone || '',
          email: seededEmployee.email || '',
          role: seededEmployee.role === 'owner' ? 'admin' : (seededEmployee.role || 'technician'),
          status: seededEmployee.is_active === false ? 'inactive' : 'active'
        }]);
      } else {
        setEmployees(normalizedEmployees);
      }

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Employee functions
  const openEmployeeDialog = (employee = null) => {
    if (employee) {
      setEditingEmployee(employee);
      setEmployeeForm({
        full_name: employee.full_name,
        phone: employee.phone,
        email: employee.email || '',
        role: employee.role,
        status: employee.status
      });
    } else {
      setEditingEmployee(null);
      setEmployeeForm({
        full_name: '',
        phone: '',
        email: '',
        role: 'technician',
        status: 'active'
      });
    }
    setEmployeeDialogOpen(true);
  };

  const saveEmployee = async () => {
    if (!user) return;
    setSavingEmployee(true);
    try {
      const payload = {
        name: employeeForm.full_name,
        phone: employeeForm.phone || '',
        email: employeeForm.email || '',
        role: employeeForm.role,
        is_active: employeeForm.status === 'active'
      };
      if (editingEmployee) {
        const { error } = await supabase
          .from('employees')
          .update(payload)
          .eq('id', editingEmployee.id)
          .eq('owner_id', user.id);
        if (error) throw error;
        setEmployees(employees.map(e => e.id === editingEmployee.id ? { ...e, ...employeeForm } : e));
      } else {
        const { data: newEmployee, error } = await supabase
          .from('employees')
          .insert([{ ...payload, owner_id: user.id }])
          .select('*')
          .single();
        if (error) throw error;
        setEmployees([{
          id: newEmployee.id,
          full_name: newEmployee.name || '',
          phone: newEmployee.phone || '',
          email: newEmployee.email || '',
          role: newEmployee.role === 'owner' ? 'admin' : (newEmployee.role || 'technician'),
          status: newEmployee.is_active === false ? 'inactive' : 'active'
        }, ...employees]);
      }
      setEmployeeDialogOpen(false);
    } catch (error) {
      console.error('Error saving employee:', error);
    } finally {
      setSavingEmployee(false);
    }
  };

  const deleteEmployee = async () => {
    if (!employeeToDelete || !user) return;
    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', employeeToDelete.id)
        .eq('owner_id', user.id);
      if (error) throw error;
      setEmployees(employees.filter(e => e.id !== employeeToDelete.id));
    } catch (error) {
      console.error('Error deleting employee:', error);
    } finally {
      setDeleteEmployeeDialogOpen(false);
      setEmployeeToDelete(null);
    }
  };

  if (isLoadingAuth) return <LoadingSpinner />;
  if (!user) return null;
  if (loading) return <LoadingSpinner />;

  return (
    <div dir="rtl" className="p-4 lg:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3">
          <SettingsIcon className="w-8 h-8" />
          הגדרות
        </h1>
        <p className="text-slate-500 mt-1">נהל והתאם אישית את המערכת</p>
      </div>

      <Tabs defaultValue="general" dir="rtl">
        <TabsList className="flex flex-wrap h-auto gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-full lg:w-auto">
          <TabsTrigger value="general" className="flex items-center gap-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700">
            <SlidersHorizontal className="w-4 h-4" />
            כללי
          </TabsTrigger>
          <TabsTrigger value="employees" className="flex items-center gap-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700">
            <Users className="w-4 h-4" />
            עובדים
          </TabsTrigger>
          <TabsTrigger value="customization" className="flex items-center gap-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700">
            <Palette className="w-4 h-4" />
            התאמה אישית
          </TabsTrigger>
          <TabsTrigger value="job-types" className="flex items-center gap-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700">
            <Briefcase className="w-4 h-4" />
            סוגי עבודות
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700">
            <Plug className="w-4 h-4" />
            אינטגרציות
          </TabsTrigger>
        </TabsList>

        {/* General Settings Tab */}
        <TabsContent value="general" className="mt-6">
          <GeneralSettingsTab />
        </TabsContent>

        {/* Employees Tab */}
        <TabsContent value="employees" className="mt-6 space-y-6">
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">ניהול עובדים</CardTitle>
                <CardDescription>הוסף ונהל עובדים במערכת</CardDescription>
              </div>
              <Button onClick={() => openEmployeeDialog()} style={{ backgroundColor: '#00214d' }} className="hover:opacity-90">
                <Plus className="w-4 h-4 ml-2" />
                עובד חדש
              </Button>
            </CardHeader>
            <CardContent>
              {employees.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="אין עובדים"
                  description="הוסף עובדים כדי להקצות להם עבודות"
                  actionLabel="הוסף עובד ראשון"
                  onAction={() => openEmployeeDialog()}
                />
              ) : (
                <div className="space-y-3">
                  {employees.map((employee) => (
                    <div
                      key={employee.id}
                      className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-emerald-100 text-emerald-700">
                          {employee.full_name?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-800 dark:text-slate-100">{employee.full_name}</h4>
                        <p className="text-sm text-slate-500" dir="ltr">{employee.phone}</p>
                      </div>
                      <Badge variant="outline" className={
                        employee.role === 'admin' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                        employee.role === 'technician' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                        'bg-slate-100 text-slate-700 border-slate-200'
                      }>
                        {roleLabels[employee.role]}
                      </Badge>
                      <Badge variant="outline" className={
                        employee.status === 'active'
                          ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }>
                        {employee.status === 'active' ? 'פעיל' : 'לא פעיל'}
                      </Badge>
                      <DropdownMenu dir="rtl">
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem onClick={() => openEmployeeDialog(employee)}>
                            <Edit className="w-4 h-4 ml-2" />
                            עריכה
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setEmployeeToDelete(employee);
                              setDeleteEmployeeDialogOpen(true);
                            }}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4 ml-2" />
                            מחיקה
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Account card stays in employees tab for easy access */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">חשבון</CardTitle>
              <CardDescription>ניהול התחברות משתמש</CardDescription>
            </CardHeader>
            <CardContent>
              <Button type="button" variant="outline" className="text-red-600" onClick={() => logout()}>
                <LogOut className="w-4 h-4 ml-2" />
                התנתקות
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Customization Tab */}
        <TabsContent value="customization" className="mt-6">
          <CustomizationTab configs={configs} setConfigs={setConfigs} />
        </TabsContent>

        {/* Job Types Tab */}
        <TabsContent value="job-types" className="mt-6">
          <JobTypesTab />
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="mt-6">
          <IntegrationsTab />
        </TabsContent>
      </Tabs>

      {/* Employee Dialog */}
      <Dialog open={employeeDialogOpen} onOpenChange={setEmployeeDialogOpen}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEmployee ? 'עריכת עובד' : 'עובד חדש'}</DialogTitle>
            <DialogDescription>
              {editingEmployee ? 'עדכן את פרטי העובד' : 'הוסף עובד חדש למערכת'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>שם מלא *</Label>
              <Input
                value={employeeForm.full_name}
                onChange={(e) => setEmployeeForm({ ...employeeForm, full_name: e.target.value })}
                placeholder="שם העובד"
              />
            </div>
            <div className="space-y-2">
              <Label>טלפון *</Label>
              <Input
                value={employeeForm.phone}
                onChange={(e) => setEmployeeForm({ ...employeeForm, phone: e.target.value })}
                placeholder="050-0000000"
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label>אימייל</Label>
              <Input
                type="email"
                value={employeeForm.email}
                onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })}
                placeholder="email@example.com"
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label>תפקיד</Label>
              <Select value={employeeForm.role} onValueChange={(v) => setEmployeeForm({ ...employeeForm, role: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">מנהל</SelectItem>
                  <SelectItem value="technician">טכנאי</SelectItem>
                  <SelectItem value="office">משרד</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>סטטוס</Label>
              <Select value={employeeForm.status} onValueChange={(v) => setEmployeeForm({ ...employeeForm, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">פעיל</SelectItem>
                  <SelectItem value="inactive">לא פעיל</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex-row-reverse gap-2">
            <Button
              onClick={saveEmployee}
              disabled={savingEmployee || !employeeForm.full_name || !employeeForm.phone}
              style={{ backgroundColor: '#00214d' }}
              className="hover:opacity-90"
            >
              {savingEmployee ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Save className="w-4 h-4 ml-2" />}
              שמור
            </Button>
            <Button variant="outline" onClick={() => setEmployeeDialogOpen(false)}>ביטול</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Employee Dialog */}
      <AlertDialog open={deleteEmployeeDialogOpen} onOpenChange={setDeleteEmployeeDialogOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת עובד</AlertDialogTitle>
            <AlertDialogDescription>
              האם אתה בטוח שברצונך למחוק את העובד &quot;{employeeToDelete?.full_name}&quot;?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={deleteEmployee} className="bg-red-500 hover:bg-red-600">מחק</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
