import HeartIcon from 'mdi-react/HeartIcon'
import { otherGroup, siteAdminSidebarGroups, usersGroup, overviewGroup } from '../../site-admin/sidebaritems'
import { SiteAdminSideBarGroup, SiteAdminSideBarGroups } from '../../site-admin/SiteAdminSidebar'
import { SHOW_BUSINESS_FEATURES } from '../dotcom/productSubscriptions/features'

/**
 * Sidebar items that are only used on Sourcegraph.com.
 */
const dotcomGroup: SiteAdminSideBarGroup = {
    header: { label: 'Business', icon: HeartIcon },
    items: [
        {
            label: 'Customers',
            to: '/site-admin/dotcom/customers',
            condition: () => SHOW_BUSINESS_FEATURES,
        },
        {
            label: 'Subscriptions',
            to: '/site-admin/dotcom/product/subscriptions',
            condition: () => SHOW_BUSINESS_FEATURES,
        },
        {
            label: 'License key lookup',
            to: '/site-admin/dotcom/product/licenses',
            condition: () => SHOW_BUSINESS_FEATURES,
        },
    ],
    condition: () => SHOW_BUSINESS_FEATURES,
}

export const enterpriseSiteAdminSidebarGroups: SiteAdminSideBarGroups = siteAdminSidebarGroups.reduce<
    SiteAdminSideBarGroups
>((enterpriseGroups, group) => {
    if (group === overviewGroup) {
        return [
            ...enterpriseGroups,
            // Extend overview group items
            {
                ...group,
                items: [
                    ...group.items,
                    {
                        label: 'License',
                        to: '/site-admin/license',
                    },
                ],
            },
        ]
    }
    if (group === usersGroup) {
        return [
            ...enterpriseGroups,
            // Extend users group items
            {
                ...group,
                items: [
                    ...group.items,
                    {
                        label: 'Auth providers',
                        to: '/site-admin/auth/providers',
                    },
                    {
                        label: 'External accounts',
                        to: '/site-admin/auth/external-accounts',
                    },
                ],
            },
        ]
    }
    if (group === otherGroup) {
        return [
            ...enterpriseGroups,
            // Extend other group items
            {
                ...group,
                items: [
                    ...group.items,
                    {
                        label: 'Extensions',
                        to: '/site-admin/registry/extensions',
                    },
                ],
            },
            // Insert dotcom group after other group (on Sourcegraph.com)
            dotcomGroup,
        ]
    }
    return [...enterpriseGroups, group]
}, [])
