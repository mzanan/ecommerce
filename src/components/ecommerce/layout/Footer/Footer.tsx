'use client'

import React from 'react';
import Link from 'next/link';
import { Mail, Instagram, Facebook } from 'lucide-react';
import { SOCIAL_LINKS, COMPANY_INFO, CONTACT_INFO } from '@/lib/constants/social';

const Footer = () => {
  return (
    <footer className="bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 py-8 z-10">
      <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center">
        <div className="text-sm mb-4 md:mb-0">
          © {COMPANY_INFO.FOUNDED_YEAR} {COMPANY_INFO.NAME}. All rights reserved.
        </div>
        <div className="flex space-x-4">
          <Link href={SOCIAL_LINKS.FACEBOOK} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className='hover:text-primary transition-colors'>
             <Facebook className="h-5 w-5" />
          </Link>
          <Link href={SOCIAL_LINKS.INSTAGRAM} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className='hover:text-primary transition-colors'>
            <Instagram className="h-5 w-5" />
          </Link>
          <Link href={`mailto:${CONTACT_INFO.EMAIL}`} aria-label="Email" className='hover:text-primary transition-colors'>
            <Mail className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 