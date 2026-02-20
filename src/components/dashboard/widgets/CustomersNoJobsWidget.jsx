import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export default function CustomersNoJobsWidget({ data }) {
  const navigate = useNavigate();
  const { interestedAccounts } = data;

  return (
    <Card className="border-0 shadow-sm h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/50">
            <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </span>
          לקוחות ללא עבודה
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {interestedAccounts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center dark:border-slate-700">
            <Users className="mx-auto mb-2 h-8 w-8 text-slate-300 dark:text-slate-600" />
            <p className="text-sm text-slate-500 dark:text-slate-400">אין כרגע לקוחות ללא עבודה</p>
          </div>
        ) : (
          interestedAccounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                    {account.account_name?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-slate-800 dark:text-slate-200">{account.account_name}</span>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => navigate(createPageUrl('JobForm'))}>
                <Plus className="ml-1 h-4 w-4" />
                עבודה
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
