<?php

namespace App\Services\Moderation;

interface ProviderInterface
{
    /**
     * Scan text and return an array of violations with keys like ['type'=>'pornographic','confidence'=>0.92,'match'=>'...']
     *
     * @param string $text
     * @return array
     */
    public function scanText(string $text): array;

    /**
     * Scan a file meta (filename,mime) and return an array of violations
     * @param array $fileInfo
     * @return array
     */
    public function scanFile(array $fileInfo): array;
}
