<?php
/**
 * Notify
 * Developer: Munyaradzi Chenjerai
 */

namespace App\Services;


final class Notify {

    // Created Notification
    static function createdNotification(): \Flasher\Prime\Notification\Envelope {
        return notyf()->addSuccess('Created Successfully', 'Success!');
    }

    // Updated Notification
    static function updatedNotification(): \Flasher\Prime\Notification\Envelope {
        return notyf()->addSuccess('Updated Successfully', 'Success!');
    }

    // Deleted Notification
    static function deletedNotification(): \Flasher\Prime\Notification\Envelope {
        return notyf()->addSuccess('Deleted Successfully', 'Success!');
    }

    static function errorNotification(string $error): \Flasher\Prime\Notification\Envelope {
        return notyf()->addError($error, 'Error!');
    }

    static function successNotification(string $message): \Flasher\Prime\Notification\Envelope {
        return notyf()->addSuccess($message, 'Success!');
    }




}

