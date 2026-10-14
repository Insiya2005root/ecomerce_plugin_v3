'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Nav() {
  const pathname = usePathname();
  
  const links = [
    { name: 'Dashboard', href: '/' },
    { name: 'Products', href: '/products' },
    { name: 'Categories', href: '/categories' },
    { name: 'Orders', href: '/orders' },
    { name: 'Customers', href: '/customers' },
    { name: 'Discounts', href: '/discounts' },
    { name: 'Settings', href: '/settings' },
  ];

  return (
    <nav className="mb-8 flex gap-4 overflow-x-auto pb-4 pt-2 px-2">
      {links.map(link => {
        const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
        return (
          <Link
            key={link.name}
            href={link.href}
            className={`px-5 py-2 font-semibold tracking-wide border border-[color:var(--border-color)] rounded-md transition-all whitespace-nowrap ${
              isActive 
                ? 'bg-[color:var(--bg-primary)] text-[color:var(--text-primary)] shadow-sm translate-y-[-2px]' 
                : 'bg-[color:var(--bg-card)] text-[color:var(--text-main)] hover:shadow-sm hover:translate-y-[-2px]'
            }`}
          >
            {link.name}
          </Link>
        );
      })}
    </nav>
  );
}



