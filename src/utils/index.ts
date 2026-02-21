export function createPageUrl(pageName: string) {
    const [rawPage, queryString = ''] = pageName.split('?');
    const params = new URLSearchParams(queryString);

    if (rawPage === 'QuoteForm') {
        const id = params.get('id');
        const accountId = params.get('account_id') || params.get('client_id');

        if (id) {
            return `/quotes/${encodeURIComponent(id)}/edit`;
        }

        if (accountId) {
            return `/quotes/new?account_id=${encodeURIComponent(accountId)}`;
        }

        return '/quotes/new';
    }

    if (rawPage === 'QuoteDetails') {
        const id = params.get('id');
        if (id) {
            return `/quotes/${encodeURIComponent(id)}`;
        }
        return '/quotes';
    }

    if (rawPage === 'Quotes') {
        return '/quotes';
    }

    if (rawPage === 'Clients') {
        return '/clients';
    }

    if (rawPage === 'Leads') {
        return '/leads';
    }

    if (rawPage === 'Jobs') {
        return '/jobs';
    }

    if (rawPage === 'JobForm') {
        const query = params.toString();
        return query ? `/jobs/new?${query}` : '/jobs/new';
    }

    if (rawPage === 'JobDetails') {
        const id = params.get('id');
        if (id) {
            params.delete('id');
            const remaining = params.toString();
            return `/jobs/${encodeURIComponent(id)}${remaining ? `?${remaining}` : ''}`;
        }
        const query = params.toString();
        return query ? `/jobs?${query}` : '/jobs';
    }

    if (rawPage === 'ClientForm') {
        const id = params.get('id');
        if (id) {
            params.delete('id');
            const remaining = params.toString();
            return `/clients/${encodeURIComponent(id)}${remaining ? `?${remaining}` : ''}`;
        }
        const query = params.toString();
        return query ? `/clients/new?${query}` : '/clients/new';
    }

    const basePath = rawPage.replace(/ /g, '-');
    return '/' + basePath + (queryString ? `?${queryString}` : '');
}
