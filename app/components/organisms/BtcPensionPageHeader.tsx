'use client';

import React from 'react';

/************************************************************************************************
 * Embedded meme (Bitcoin tree cartoon) as external URL
 ************************************************************************************************/
const memeSrc = `https://public.bnbstatic.com/image-proxy/rs_lg_webp/static/content/square/images/ea01f73e06f740dd94a7e420888ba115.jpg`;

/***********************************
 * Page Header Component
 ***********************************/
const BtcPensionPageHeader: React.FC = () => (
  <>
    <header className="text-center space-y-4">
      <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-amber-400 to-orange-600 bg-clip-text text-transparent drop-shadow-lg">
        Bitcoin Treasury Growth Simulation
      </h1>
      <p className="text-sm md:text-base text-gray-300 max-w-3xl mx-auto">
        DCA simulation with platform fee modeling. User accumulation and
        platform revenue growth under ideal conditions.
      </p>
      <p className="text-xs md:text-sm text-gray-400 max-w-3xl mx-auto">
        Enter % fields as <em>percent values</em>; the model converts them to
        fractions.
      </p>
    </header>

    <img
      src={memeSrc}
      alt="Bitcoin tree cartoon meme"
      className="mx-auto w-80 md:w-[28rem] my-6 rounded-lg shadow-lg"
    />
  </>
);

export default BtcPensionPageHeader;
